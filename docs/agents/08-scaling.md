# Scaling & Deployment

This document describes how to scale the agent system, deployment considerations, and operational requirements.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCALABLE ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    LOAD BALANCER                            │ │
│  │                    (nginx / ALB)                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│            ┌─────────────┼─────────────┐                        │
│            ▼             ▼             ▼                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │   Web App    │ │   Web App    │ │   Web App    │            │
│  │   (Next.js)  │ │   (Next.js)  │ │   (Next.js)  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│            │             │             │                        │
│            └─────────────┼─────────────┘                        │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    REDIS CLUSTER                            │ │
│  │              (BullMQ Job Queues)                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│            ┌─────────────┼─────────────┐                        │
│            ▼             ▼             ▼                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │   Worker 1   │ │   Worker 2   │ │   Worker N   │            │
│  │ (BullMQ)     │ │ (BullMQ)     │ │ (BullMQ)     │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│            │             │             │                        │
│            └─────────────┼─────────────┘                        │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              POSTGRESQL (Primary + Read Replicas)           │ │
│  │                    + pgvector extension                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    OBJECT STORAGE                           │ │
│  │             (MinIO / Cloudflare R2 / S3)                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Horizontal Scaling

### Worker Scaling

Workers are stateless and can scale horizontally:

```typescript
// Each worker instance processes jobs independently
// BullMQ ensures each job is processed by exactly one worker

// Worker count recommendations by tier
const WORKER_SCALING = {
  small: {
    workers: 1,
    concurrencyPerWorker: 5,
    totalConcurrency: 5
  },
  medium: {
    workers: 3,
    concurrencyPerWorker: 5,
    totalConcurrency: 15
  },
  large: {
    workers: 10,
    concurrencyPerWorker: 10,
    totalConcurrency: 100
  }
}
```

### Auto-Scaling Rules

```yaml
# Kubernetes HPA configuration
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: worker
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: External
      external:
        metric:
          name: bullmq_queue_depth
          selector:
            matchLabels:
              queue: content-generate
        target:
          type: AverageValue
          averageValue: "100"  # Scale up when queue > 100 per worker
```

### Queue-Based Scaling Signals

| Metric | Scale Up When | Scale Down When |
|--------|---------------|-----------------|
| Queue depth | > 100 jobs waiting | < 10 jobs waiting |
| Processing latency | p95 > 60s | p95 < 10s |
| CPU utilization | > 70% | < 30% |
| Memory utilization | > 80% | < 50% |

## Resource Requirements

### Worker Resources

```yaml
# Per worker instance
resources:
  requests:
    cpu: "500m"
    memory: "512Mi"
  limits:
    cpu: "2000m"
    memory: "2Gi"
```

### Resource by Job Type

| Job Type | CPU | Memory | Notes |
|----------|-----|--------|-------|
| Content Analysis | Low | Medium | I/O bound (AI API calls) |
| Content Generation | Low | Medium | I/O bound (AI API calls) |
| Publishing | Low | Low | I/O bound (platform APIs) |
| Video Processing | High | High | CPU for transcoding, memory for buffers |
| Embedding Generation | Low | Medium | I/O bound (AI API calls) |

### Memory Considerations

```typescript
// Memory usage per concurrent job
const MEMORY_PER_JOB = {
  'content:analyze': {
    text: 10 * 1024 * 1024,     // 10 MB
    image: 50 * 1024 * 1024,    // 50 MB
    video: 500 * 1024 * 1024    // 500 MB (frame buffers)
  },
  'content:generate': 20 * 1024 * 1024,   // 20 MB (prompt + response)
  'post:publish': 5 * 1024 * 1024,         // 5 MB
  'analytics:collect': 2 * 1024 * 1024     // 2 MB
}

// Calculate safe concurrency based on available memory
function calculateSafeConcurrency(availableMemoryMB: number): number {
  const avgJobMemory = 50  // MB, conservative average
  const overhead = 200     // MB, runtime overhead
  return Math.floor((availableMemoryMB - overhead) / avgJobMemory)
}
```

## Connection Pool Management

### Database Connections

```typescript
// Prisma connection pool configuration
// In schema.prisma or via environment
datasources {
  db {
    provider = "postgresql"
    url = env("DATABASE_URL")
    connectionLimit = env("DATABASE_POOL_SIZE")  // Default: 10
  }
}

// Connection pool sizing
const DB_POOL_CONFIG = {
  // Base: 2 connections per worker
  // Plus: 1 per concurrent job
  // Formula: workers * (2 + concurrency)
  small: 15,   // 1 worker × (2 + 5) + buffer
  medium: 50,  // 3 workers × (2 + 5) + buffer
  large: 150   // 10 workers × (2 + 10) + buffer
}
```

### Redis Connections

```typescript
// BullMQ uses multiple connections per worker
// - 1 for job processing
// - 1 for blocking commands
// - 1 for events

const REDIS_CONNECTIONS_PER_WORKER = 3

// Connection pool for queue operations
const redisPool = new IORedis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // Connection pool settings
  family: 4,
  connectTimeout: 10000,
  commandTimeout: 5000,
  keepAlive: 30000
})
```

### Connection Limits by Component

| Component | Max Connections | Per-Instance |
|-----------|-----------------|--------------|
| PostgreSQL | 100 (default) | 10-20 per worker |
| Redis | 10,000 | 3-5 per worker |
| External APIs | Per rate limit | Shared pool |

## Database Scaling

### Read Replicas

```typescript
// Use read replicas for heavy read operations
const readReplica = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_REPLICA_URL }
  }
})

// Route reads to replica
async function getRecentPosts(brandProfileId: string): Promise<Post[]> {
  return await readReplica.post.findMany({
    where: {
      brandProfileId,
      publishedAt: { gte: subDays(new Date(), 30) }
    }
  })
}

// Writes always go to primary
async function createPost(data: PostData): Promise<Post> {
  return await prisma.post.create({ data })
}
```

### pgvector Performance

```sql
-- Create index for similarity queries
CREATE INDEX content_embeddings_embedding_idx
ON content_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Tune for concurrent queries
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET work_mem = '256MB';
```

### Query Optimization

```typescript
// Batch embedding queries
async function checkSimilarityBatch(
  embeddings: number[][],
  brandProfileId: string
): Promise<SimilarityResult[]> {
  // Single query with multiple embeddings
  const results = await prisma.$queryRaw`
    WITH input_embeddings AS (
      SELECT unnest($1::vector[]) as embedding,
             generate_subscripts($1::vector[], 1) as idx
    )
    SELECT ie.idx, MAX(1 - (ce.embedding <=> ie.embedding)) as max_similarity
    FROM input_embeddings ie
    CROSS JOIN LATERAL (
      SELECT embedding
      FROM content_embeddings ce
      WHERE ce.brand_profile_id = ${brandProfileId}
        AND ce.created_at > NOW() - INTERVAL '30 days'
      ORDER BY ce.embedding <=> ie.embedding
      LIMIT 1
    ) ce
    GROUP BY ie.idx
  `

  return results
}
```

## Deployment Strategies

### Blue-Green Deployment

```yaml
# Deploy new version alongside old
# Switch traffic when healthy

# 1. Deploy green (new) workers
kubectl apply -f worker-green.yaml

# 2. Wait for health checks
kubectl rollout status deployment/worker-green

# 3. Drain blue (old) workers
# - Stop accepting new jobs
# - Wait for in-progress jobs to complete

# 4. Switch traffic to green
kubectl patch service worker -p '{"spec":{"selector":{"version":"green"}}}'

# 5. Terminate blue workers
kubectl delete deployment worker-blue
```

### Rolling Updates

```yaml
# Kubernetes rolling update
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Add 1 new pod at a time
      maxUnavailable: 0  # Never reduce capacity
```

### Graceful Worker Shutdown

```typescript
// Worker must handle SIGTERM gracefully
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown`)

  // 1. Stop accepting new jobs
  await Promise.all([
    contentAnalyzer.pause(),
    contentGenerator.pause(),
    postPublisher.pause()
  ])

  logger.info('Workers paused, waiting for active jobs')

  // 2. Wait for active jobs (with timeout)
  const timeout = 30000  // 30 seconds
  const shutdownStart = Date.now()

  while (Date.now() - shutdownStart < timeout) {
    const activeJobs = await getActiveJobCount()
    if (activeJobs === 0) break
    await sleep(1000)
  }

  // 3. Close connections
  await Promise.all([
    contentAnalyzer.close(),
    contentGenerator.close(),
    postPublisher.close()
  ])

  await prisma.$disconnect()
  await redis.quit()

  logger.info('Graceful shutdown complete')
  process.exit(0)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
```

## Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://host:6379
REDIS_TLS=true  # For production

# AI Provider
AI_PROVIDER=gemini  # or: openai, claude, custom
GEMINI_API_KEY=xxx
# OPENAI_API_KEY=xxx  # If using OpenAI

# Storage
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=24rabbit-uploads
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx

# Security
ENCRYPTION_KEY=xxx  # 32 bytes hex for token encryption

# Worker Configuration
WORKER_CONCURRENCY=5
WORKER_ID=worker-1  # Unique per instance
```

### Environment-Specific Settings

```typescript
const CONFIG = {
  development: {
    workerConcurrency: 2,
    dbPoolSize: 5,
    logLevel: 'debug',
    enableMetrics: false
  },
  staging: {
    workerConcurrency: 5,
    dbPoolSize: 10,
    logLevel: 'info',
    enableMetrics: true
  },
  production: {
    workerConcurrency: 10,
    dbPoolSize: 20,
    logLevel: 'warn',
    enableMetrics: true
  }
}
```

## Monitoring & Observability

### Health Check Endpoint

```typescript
// Worker health check
app.get('/health', async (req, res) => {
  const checks = {
    redis: await checkRedisHealth(),
    database: await checkDatabaseHealth(),
    workers: await checkWorkerHealth()
  }

  const healthy = Object.values(checks).every(c => c.healthy)

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
    uptime: process.uptime(),
    version: process.env.APP_VERSION
  })
})

async function checkRedisHealth(): Promise<HealthCheck> {
  try {
    await redis.ping()
    return { healthy: true }
  } catch (error) {
    return { healthy: false, error: error.message }
  }
}

async function checkDatabaseHealth(): Promise<HealthCheck> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { healthy: true }
  } catch (error) {
    return { healthy: false, error: error.message }
  }
}

async function checkWorkerHealth(): Promise<HealthCheck> {
  const workers = [contentGenerator, postPublisher, analyticsCollector]
  const allRunning = workers.every(w => w.isRunning())
  return { healthy: allRunning }
}
```

### Metrics Export

```typescript
// Prometheus metrics endpoint
import { collectDefaultMetrics, Registry, Counter, Histogram, Gauge } from 'prom-client'

const register = new Registry()
collectDefaultMetrics({ register })

// Custom metrics
const jobsProcessed = new Counter({
  name: 'worker_jobs_processed_total',
  help: 'Total jobs processed',
  labelNames: ['queue', 'status']
})

const jobDuration = new Histogram({
  name: 'worker_job_duration_seconds',
  help: 'Job processing duration',
  labelNames: ['queue'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60]
})

const queueDepth = new Gauge({
  name: 'worker_queue_depth',
  help: 'Current queue depth',
  labelNames: ['queue']
})

register.registerMetric(jobsProcessed)
register.registerMetric(jobDuration)
register.registerMetric(queueDepth)

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType)
  res.send(await register.metrics())
})
```

### Logging Standards

```typescript
// Structured JSON logging for aggregation
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  base: {
    service: 'worker',
    version: process.env.APP_VERSION,
    instance: process.env.WORKER_ID
  }
})

// Log with context
logger.info({
  jobId: job.id,
  queue: job.queueName,
  duration: processingTime,
  userId: data.userId
}, 'Job completed successfully')
```

## Disaster Recovery

### Backup Strategy

```bash
# Database backups
# - Automated daily snapshots (RDS/Cloud SQL)
# - Point-in-time recovery enabled
# - Cross-region replication for critical data

# Redis persistence
# - RDB snapshots every 15 minutes
# - AOF persistence for durability
# - Replica for failover
```

### Failover Procedures

```typescript
// Automatic failover for Redis
const redis = new IORedis({
  sentinels: [
    { host: 'sentinel-1', port: 26379 },
    { host: 'sentinel-2', port: 26379 },
    { host: 'sentinel-3', port: 26379 }
  ],
  name: 'mymaster',
  role: 'master'
})

// Database failover (handled by cloud provider)
// - Automatic failover with ~30s downtime
// - Connection retry handles brief outages
```

### Recovery Time Objectives

| Component | RTO | RPO | Strategy |
|-----------|-----|-----|----------|
| Web App | < 1 min | 0 | Multi-AZ deployment |
| Workers | < 5 min | 0 | Auto-scaling group |
| Database | < 1 min | < 5 min | Multi-AZ, PITR |
| Redis | < 5 min | < 1 min | Sentinel + replicas |
| Jobs | N/A | 0 | Persisted in Redis |

## Cost Optimization

### Right-Sizing Workers

```typescript
// Monitor and adjust worker resources
const WORKER_PROFILES = {
  // For low-volume accounts
  micro: {
    instances: 1,
    cpu: '250m',
    memory: '256Mi',
    concurrency: 2
  },
  // For medium-volume
  standard: {
    instances: 2,
    cpu: '500m',
    memory: '512Mi',
    concurrency: 5
  },
  // For high-volume
  performance: {
    instances: 5,
    cpu: '1000m',
    memory: '1Gi',
    concurrency: 10
  }
}
```

### Spot Instances

```yaml
# Use spot/preemptible instances for workers
# Workers are stateless and can handle interruption
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
spec:
  template:
    spec:
      nodeSelector:
        cloud.google.com/gke-spot: "true"
      tolerations:
        - key: cloud.google.com/gke-spot
          operator: Equal
          value: "true"
          effect: NoSchedule
```

### Queue Priority

```typescript
// Process high-value jobs first
const QUEUE_PRIORITIES = {
  'post:publish': 1,        // Highest - user-facing
  'content:generate': 2,    // High - time-sensitive
  'content:analyze': 3,     // Medium - can wait
  'analytics:collect': 4    // Low - background
}

// High-priority jobs get more workers
const WORKER_ALLOCATION = {
  'post:publish': 40,       // 40% of capacity
  'content:generate': 30,   // 30%
  'content:analyze': 20,    // 20%
  'analytics:collect': 10   // 10%
}
```

## Capacity Planning

### Throughput Estimates

| Metric | Small | Medium | Large |
|--------|-------|--------|-------|
| Users | 100 | 1,000 | 10,000 |
| Posts/day | 500 | 5,000 | 50,000 |
| Materials/day | 50 | 500 | 5,000 |
| Workers needed | 1-2 | 3-5 | 10-20 |
| DB connections | 20 | 50 | 150 |

### Growth Calculations

```typescript
// Estimate resource needs based on growth
function estimateResources(dailyPosts: number): ResourceEstimate {
  // Average job duration
  const avgGenerationTime = 10  // seconds
  const avgPublishTime = 2      // seconds

  // Peak hour factor (40% of daily volume in 4 hours)
  const peakFactor = 0.4 / (4 / 24)  // 2.4x

  // Jobs per second at peak
  const peakJobsPerSecond = (dailyPosts * peakFactor) / 3600

  // Workers needed (accounting for concurrency)
  const concurrency = 5
  const workersNeeded = Math.ceil(
    peakJobsPerSecond * avgGenerationTime / concurrency
  )

  return {
    workers: Math.max(2, workersNeeded),  // Minimum 2 for HA
    dbConnections: workersNeeded * 10 + 20,
    redisMemory: `${Math.ceil(dailyPosts * 0.01)}MB`  // ~10KB per job
  }
}
```
