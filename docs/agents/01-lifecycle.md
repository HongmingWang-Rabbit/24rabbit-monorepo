# Agent Lifecycle & States

This document describes how agents initialize, process jobs, transition between states, and shut down gracefully.

## Worker Initialization

When the worker application starts (`apps/worker`), it performs the following initialization sequence:

```
1. Load environment configuration
2. Establish Redis connection (BullMQ queue backend)
3. Register job processors for each queue
4. Start cron schedulers
5. Begin processing jobs
```

### Startup Sequence

```typescript
async function main() {
  // 1. Get shared Redis connection
  const connection = getQueueConnection()

  // 2. Register processors
  const contentAnalyzer = createWorker('content:analyze', analyzeProcessor, { connection })
  const contentGenerator = createWorker('content:generate', generateProcessor, { connection })
  const postPublisher = createWorker('post:publish', publishProcessor, { connection })
  const analyticsCollector = createWorker('analytics:collect', analyticsProcessor, { connection })

  // 3. Start cron jobs
  startSchedulerCron()      // Every 5 minutes
  startAnalyticsCron()      // Every hour

  // 4. Handle graceful shutdown
  process.on('SIGTERM', gracefulShutdown)
  process.on('SIGINT', gracefulShutdown)
}
```

### Connection Configuration

```typescript
{
  maxRetriesPerRequest: null,    // Required for BullMQ
  enableReadyCheck: false,       // Faster startup
  retryStrategy: (times) => Math.min(times * 50, 2000)  // Reconnect backoff
}
```

## Agent Types

The worker runs multiple agent processors, each handling a specific job type:

### 1. Content Analyzer Agent

**Queue**: `content:analyze`

**Trigger**: User uploads new material

**Responsibilities**:
- Extract content from various formats (text, URL, PDF, image, video)
- Call AI Adapter for content analysis
- Generate summary, key points, keywords, suggested angles
- Generate embedding vector for similarity matching
- Update Material status to `READY`

**State Flow**:
```
Material PROCESSING → AI Analysis → Embedding Generated → Material READY
```

### 2. Content Generator Agent

**Queue**: `content:generate`

**Trigger**: Scheduler cron or manual generation request

**Responsibilities**:
- Load Material and Brand Profile context
- Build AI prompt with full brand context
- Generate 3 content variations per platform
- Validate content against platform limits and brand rules
- Check similarity against recent posts
- Create PendingPost records

**State Flow**:
```
Job Received → Load Context → AI Generation → Validation → Similarity Check → PendingPost Created
```

### 3. Post Publisher Agent

**Queue**: `post:publish`

**Trigger**: Scheduled time reached for approved content

**Responsibilities**:
- Load PendingPost and SocialAccount credentials
- Check platform rate limits
- Call Platform Connector to publish
- Handle media uploads
- Create Post record with platform ID
- Store embedding for future similarity checks

**State Flow**:
```
Job Received → Rate Limit Check → Platform API Call → Post Created → Analytics Queued
```

### 4. Analytics Collector Agent

**Queue**: `analytics:collect`

**Trigger**: Hourly cron job

**Responsibilities**:
- Query recent posts (last 7 days)
- Fetch metrics from each platform API
- Update Post records with engagement data
- Create daily analytics snapshots

**State Flow**:
```
Cron Trigger → Query Posts → Fetch Platform Metrics → Update Records
```

## Job States

All jobs follow the BullMQ state machine:

```
                    ┌─────────────┐
                    │   WAITING   │
                    └──────┬──────┘
                           │ Worker picks up job
                           ▼
                    ┌─────────────┐
                    │   ACTIVE    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │COMPLETED │ │  FAILED  │ │ STALLED  │
       └──────────┘ └────┬─────┘ └────┬─────┘
                         │            │
                         │ Retry?     │ Recovered
                         ▼            │
                  ┌─────────────┐     │
                  │   DELAYED   │◄────┘
                  └──────┬──────┘
                         │ Backoff expires
                         ▼
                  ┌─────────────┐
                  │   WAITING   │
                  └─────────────┘
```

### State Definitions

| State | Description |
|-------|-------------|
| WAITING | Job is queued, waiting for a worker |
| ACTIVE | Worker is currently processing the job |
| COMPLETED | Job finished successfully |
| FAILED | Job threw an error (may retry) |
| DELAYED | Job is waiting for retry backoff |
| STALLED | Worker died mid-processing (auto-recovered) |

### Retention Policy

- **Completed jobs**: Retained for 24 hours, then removed
- **Failed jobs**: Retained for 7 days for debugging
- **Stalled jobs**: Auto-moved back to waiting queue

## Cron-Triggered Behaviors

### Scheduler Cron (Every 5 Minutes)

```typescript
async function schedulerCron() {
  // 1. Query active schedules due for execution
  const dueSchedules = await db.select()
    .from(schedules)
    .where(and(
      eq(schedules.isActive, true),
      lte(schedules.nextRunAt, new Date())
    ))

  // 2. For each schedule
  for (const schedule of dueSchedules) {
    // Select material using configured strategy
    const material = await selectMaterial(schedule)

    // Check similarity
    if (await isTooSimilar(material, schedule.brandProfileId)) {
      continue // Skip, try next material
    }

    // Queue generation job
    await contentGenerateQueue.add('generate', {
      scheduleId: schedule.id,
      materialId: material.id,
      brandProfileId: schedule.brandProfileId,
      platforms: schedule.platforms
    })

    // Update next run time
    await updateNextRunAt(schedule)
  }
}
```

### Analytics Cron (Every Hour)

```typescript
async function analyticsCron() {
  // 1. Get posts from last 7 days
  const recentPosts = await db.select()
    .from(posts)
    .where(and(
      gte(posts.publishedAt, subDays(new Date(), 7)),
      isNotNull(posts.publishedAt)
    ))

  // 2. Queue analytics collection for each
  for (const post of recentPosts) {
    await analyticsQueue.add('collect', {
      postId: post.id,
      platformPostId: post.platformPostId,
      platform: post.platform
    })
  }
}
```

## Graceful Shutdown

When the worker receives a termination signal, it performs graceful shutdown:

```typescript
async function gracefulShutdown() {
  console.log('Shutdown signal received, closing gracefully...')

  // 1. Stop accepting new jobs
  await Promise.all([
    contentAnalyzer.pause(),
    contentGenerator.pause(),
    postPublisher.pause(),
    analyticsCollector.pause()
  ])

  // 2. Wait for active jobs to complete (with timeout)
  const timeout = 30000 // 30 seconds
  await Promise.race([
    Promise.all([
      contentAnalyzer.close(),
      contentGenerator.close(),
      postPublisher.close(),
      analyticsCollector.close()
    ]),
    sleep(timeout)
  ])

  // 3. Close Redis connection
  await closeQueueConnection()

  console.log('Shutdown complete')
  process.exit(0)
}
```

### Shutdown Behavior

| Signal | Behavior |
|--------|----------|
| SIGTERM | Graceful shutdown (Docker, Kubernetes) |
| SIGINT | Graceful shutdown (Ctrl+C) |
| SIGKILL | Immediate termination (jobs become stalled) |

### Stalled Job Recovery

If a worker dies unexpectedly (SIGKILL, crash, OOM):

1. Active jobs become "stalled" after `stalledInterval` (30 seconds default)
2. BullMQ automatically moves stalled jobs back to waiting queue
3. Another worker picks up and retries the job
4. Job's `attemptsMade` counter increments

## Health Checks

Workers should expose health endpoints for orchestration platforms:

```typescript
// Health check endpoint
app.get('/health', (req, res) => {
  const healthy =
    redisConnection.status === 'ready' &&
    !contentGenerator.isPaused() &&
    !postPublisher.isPaused()

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    redis: redisConnection.status,
    workers: {
      contentGenerator: contentGenerator.isRunning(),
      postPublisher: postPublisher.isRunning()
    }
  })
})
```

## Scaling Considerations

### Horizontal Scaling

Multiple worker instances can run simultaneously:

- Each worker competes for jobs from the same Redis queues
- BullMQ ensures each job is processed by exactly one worker
- Concurrency setting applies per worker instance

### Concurrency Tuning

```typescript
const worker = createWorker(queueName, processor, {
  connection,
  concurrency: 5  // Process 5 jobs simultaneously per worker
})
```

**Recommendations**:
- Content analysis: 3-5 (CPU-bound, moderate)
- Content generation: 2-3 (API-bound, respect rate limits)
- Publishing: 5-10 (I/O-bound, fast operations)
- Analytics: 10-20 (I/O-bound, bulk fetching)

## Monitoring

### Key Metrics to Track

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `jobs.waiting` | Jobs in queue | > 1000 |
| `jobs.active` | Currently processing | > concurrency × workers |
| `jobs.failed` | Failed in last hour | > 10 |
| `jobs.stalled` | Stalled jobs | > 0 |
| `processing.duration` | Job processing time | > 60s (generation) |

### Logging

All agents should log:
- Job start with ID and payload summary
- Significant processing steps
- External API calls (AI, platforms)
- Job completion with duration
- Errors with full context

```typescript
logger.info('Processing content generation', {
  jobId: job.id,
  materialId: data.materialId,
  brandProfileId: data.brandProfileId,
  platforms: data.platforms
})
```
