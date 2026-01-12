# Redis Schema Documentation

This document describes the Redis usage patterns and data structures in the 24Rabbit platform.

## Overview

Redis serves as the backing store for **BullMQ job queues**, handling distributed task processing for:
- Content publishing to social platforms
- AI-powered content scheduling and generation
- Analytics collection from platform APIs

## Configuration

### Environment Variables

```bash
REDIS_URL="redis://localhost:6379"
```

### Connection Setup

**File:** `packages/queue/src/connection.ts`

The codebase uses a singleton pattern with IORedis:

```typescript
new IORedis(redisUrl, {
  maxRetriesPerRequest: null,  // Required for BullMQ
  enableReadyCheck: false,     // BullMQ compatibility
});
```

### Docker Setup

```yaml
# docker-compose.yml
redis:
  image: redis:7-alpine
  container_name: 24rabbit-redis
  ports:
    - '6379:6379'
  volumes:
    - redis_data:/data  # Persistent storage
```

## Queue Definitions

**File:** `packages/queue/src/queues.ts`

### 1. Publish Queue

Handles posting approved content to social platforms.

| Property | Value |
|----------|-------|
| Queue Name | `publish` |
| Purpose | Publish posts to connected social accounts |

**Job Data Schema:**
```typescript
interface PublishJobData {
  postId: string;           // Reference to Post record in PostgreSQL
  brandProfileId: string;   // Brand profile context
  socialAccountId: string;  // Social account credentials to use
  content: string;          // Post text content
  mediaUrls?: string[];     // Optional media attachments (S3/MinIO URLs)
}
```

### 2. Schedule Queue

Handles autopilot content generation based on schedules.

| Property | Value |
|----------|-------|
| Queue Name | `schedule` |
| Purpose | Trigger AI content generation for scheduled slots |

**Job Data Schema:**
```typescript
interface ScheduleJobData {
  scheduleId: string;       // Reference to Schedule record
  brandProfileId: string;   // Brand profile for content generation
}
```

### 3. Analytics Queue

Collects engagement metrics from social platforms.

| Property | Value |
|----------|-------|
| Queue Name | `analytics` |
| Purpose | Fetch post metrics (likes, shares, comments) |

**Job Data Schema:**
```typescript
interface AnalyticsJobData {
  postId: string;           // Reference to Post record
  platformPostId: string;   // External ID on the platform (e.g., tweet ID)
  platform: string;         // Platform enum: TWITTER, LINKEDIN, FACEBOOK, etc.
}
```

## Job Configuration

All queues share these default settings:

| Setting | Value | Description |
|---------|-------|-------------|
| `attempts` | 3 | Maximum retry attempts |
| `backoff.type` | exponential | Backoff strategy |
| `backoff.delay` | 1000ms | Initial retry delay (1s, 2s, 4s) |
| `removeOnComplete.age` | 86400s | Delete completed jobs after 24 hours |
| `removeOnComplete.count` | 1000 | Keep max 1000 completed jobs |
| `removeOnFail.age` | 604800s | Delete failed jobs after 7 days |

### Worker Configuration

| Setting | Value |
|---------|-------|
| `concurrency` | 5 jobs per worker |

## Redis Key Naming Conventions

BullMQ uses the prefix `bull:` followed by the queue name. Key patterns:

```
bull:{queueName}              # Queue metadata
bull:{queueName}:id           # Job ID counter
bull:{queueName}:waiting      # Jobs waiting to be processed (list)
bull:{queueName}:active       # Jobs currently processing (list)
bull:{queueName}:completed    # Completed jobs (sorted set)
bull:{queueName}:failed       # Failed jobs (sorted set)
bull:{queueName}:delayed      # Delayed jobs (sorted set)
bull:{queueName}:paused       # Paused jobs (list)
bull:{queueName}:meta         # Queue metadata (hash)
bull:{queueName}:{jobId}      # Individual job data (hash)
```

**Example keys for the publish queue:**
```
bull:publish
bull:publish:id
bull:publish:waiting
bull:publish:active
bull:publish:completed
bull:publish:failed
bull:publish:12345            # Job with ID 12345
```

## Job Lifecycle

```
              ┌─────────┐
              │ WAITING │
              └────┬────┘
                   │
              ┌────▼────┐
              │ ACTIVE  │
              └────┬────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    ┌────▼────┐         ┌────▼────┐
    │COMPLETED│         │ FAILED  │
    └─────────┘         └────┬────┘
                             │
                   ┌─────────┴─────────┐
                   │ attempts < 3?     │
                   └─────────┬─────────┘
                        yes  │  no
                   ┌─────────┴─────────┐
                   │                   │
              ┌────▼────┐         ┌────▼────┐
              │  RETRY  │         │  DEAD   │
              │(WAITING)│         │(FAILED) │
              └─────────┘         └─────────┘
```

## Usage Examples

### Adding a Job

```typescript
import { publishQueue, PublishJobData } from '@24rabbit/queue';

const jobData: PublishJobData = {
  postId: 'clx123abc',
  brandProfileId: 'clx456def',
  socialAccountId: 'clx789ghi',
  content: 'Check out our new product!',
  mediaUrls: ['https://minio.example.com/bucket/image.jpg'],
};

await publishQueue.add('publish-post', jobData);
```

### Creating a Worker

```typescript
import { createWorker, PublishJobData, QUEUE_NAMES } from '@24rabbit/queue';

const publishWorker = createWorker<PublishJobData>(
  QUEUE_NAMES.PUBLISH,
  async (job) => {
    const { postId, socialAccountId, content, mediaUrls } = job.data;
    // Publish to social platform...
  }
);
```

### Graceful Shutdown

```typescript
import { closeQueueConnection } from '@24rabbit/queue';

process.on('SIGTERM', async () => {
  await closeQueueConnection();
  process.exit(0);
});
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `bullmq` | ^5.0.0 | Job queue library |
| `ioredis` | ^5.4.0 | Redis client |

## Planned Queues (Not Yet Implemented)

These queues are referenced in architecture docs but not yet defined in `packages/queue/src/queues.ts`:

### 4. Content Analyze Queue

Processes uploaded materials for AI analysis.

| Property | Value |
|----------|-------|
| Queue Name | `content:analyze` |
| Purpose | Analyze uploaded images/videos, extract metadata |

**Job Data Schema:**
```typescript
interface ContentAnalyzeJobData {
  materialId: string;         // Reference to Material record
  userId: string;             // Owner of the material
  fileUrl: string;            // S3/MinIO URL to process
  fileType: 'IMAGE' | 'VIDEO';
}
```

### 5. Embedding Generate Queue

Creates vector embeddings for content deduplication.

| Property | Value |
|----------|-------|
| Queue Name | `embedding:generate` |
| Purpose | Generate pgvector embeddings for similarity search |

**Job Data Schema:**
```typescript
interface EmbeddingGenerateJobData {
  contentId: string;          // Reference to analyzed content
  text?: string;              // Text content to embed
  imageUrl?: string;          // Image to embed (if using CLIP)
}
```

### 6. Token Refresh Queue

Handles OAuth token refresh for social accounts.

| Property | Value |
|----------|-------|
| Queue Name | `token:refresh` |
| Purpose | Proactively refresh expiring OAuth tokens |

**Job Data Schema:**
```typescript
interface TokenRefreshJobData {
  socialAccountId: string;    // Reference to SocialAccount record
  platform: string;           // Platform enum
  expiresAt: string;          // ISO timestamp of token expiry
}
```

---

## Rate Limiting

Platform-specific rate limits using Redis counters.

### Key Schema

```
ratelimit:{userId}:{platform}:{date}
```

| Component | Example | Description |
|-----------|---------|-------------|
| `userId` | `clx123abc` | User or brand profile ID |
| `platform` | `twitter` | Lowercase platform name |
| `date` | `2024-01-15` | ISO date (YYYY-MM-DD) |

**Example keys:**
```
ratelimit:clx123abc:twitter:2024-01-15
ratelimit:clx123abc:linkedin:2024-01-15
ratelimit:clx123abc:facebook:2024-01-15
```

### Platform Limits

| Platform | Daily Limit | Key TTL |
|----------|-------------|---------|
| Twitter/X | 50 posts | 86400s (24h) |
| LinkedIn | 100 posts | 86400s (24h) |
| Facebook | 50 posts | 86400s (24h) |
| Instagram | 25 posts | 86400s (24h) |

### Implementation Pattern

```typescript
const key = `ratelimit:${userId}:${platform}:${date}`;
const current = await redis.incr(key);

if (current === 1) {
  // First post of the day - set expiry
  await redis.expire(key, 86400);
}

if (current > PLATFORM_LIMITS[platform]) {
  throw new RateLimitExceededError(platform);
}
```

---

## Caching

### Key Schema

```
cache:{domain}:{identifier}
```

### Cache Keys

| Key Pattern | Purpose | TTL |
|-------------|---------|-----|
| `cache:brand:{brandProfileId}` | Brand profile config | 3600s (1h) |
| `cache:account:{socialAccountId}:valid` | Token validity flag | 300s (5m) |
| `cache:platform:{platform}:status` | Platform API health | 60s (1m) |
| `cache:user:{userId}:credits` | Credit balance | 60s (1m) |

**Example keys:**
```
cache:brand:clx456def
cache:account:clx789ghi:valid
cache:platform:twitter:status
cache:user:clx123abc:credits
```

### Cache Invalidation

Invalidate on database writes:
- Brand profile update → delete `cache:brand:{id}`
- Token refresh → delete `cache:account:{id}:valid`
- Credit transaction → delete `cache:user:{id}:credits`

---

## Pub/Sub Channels

Real-time notifications using Redis pub/sub.

### Channel Naming

```
{domain}:{event}:{scope}
```

### Channels

| Channel Pattern | Purpose | Payload |
|-----------------|---------|---------|
| `jobs:completed:{userId}` | Job completion notification | `{ jobId, queue, status }` |
| `jobs:failed:{userId}` | Job failure alert | `{ jobId, queue, error }` |
| `posts:published:{brandProfileId}` | Post published event | `{ postId, platform, url }` |
| `analytics:updated:{postId}` | Metrics refresh | `{ likes, shares, comments }` |
| `system:maintenance` | System-wide alerts | `{ message, severity }` |

**Example usage:**
```typescript
// Publisher (worker)
await redis.publish(
  `posts:published:${brandProfileId}`,
  JSON.stringify({ postId, platform, url })
);

// Subscriber (web app via WebSocket)
redis.subscribe(`jobs:completed:${userId}`);
redis.on('message', (channel, message) => {
  ws.send(message);
});
```

---

## Queue Monitoring

### Bull Board Setup (Recommended)

```typescript
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
createBullBoard({
  queues: [
    new BullMQAdapter(publishQueue),
    new BullMQAdapter(scheduleQueue),
    new BullMQAdapter(analyticsQueue),
  ],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
```

### Health Check Keys

```
health:worker:{workerId}:heartbeat    # Worker heartbeat timestamp
health:queue:{queueName}:depth        # Queue depth snapshot
```

### Metrics to Track

| Metric | Redis Command | Description |
|--------|---------------|-------------|
| Queue depth | `LLEN bull:{queue}:waiting` | Jobs waiting |
| Active jobs | `LLEN bull:{queue}:active` | Jobs processing |
| Failed count | `ZCARD bull:{queue}:failed` | Failed jobs |
| Completed count | `ZCARD bull:{queue}:completed` | Completed jobs |

---

## Session Storage (If Using Redis Sessions)

### Key Schema

```
session:{sessionId}
```

### Session Data

```typescript
interface SessionData {
  userId: string;
  email: string;
  expiresAt: number;        // Unix timestamp
  createdAt: number;
}
```

### TTL Strategy

| Session Type | TTL |
|--------------|-----|
| Default session | 7 days (604800s) |
| "Remember me" | 30 days (2592000s) |
| API token | No expiry (until revoked) |

---

## Production Considerations

### Memory Management

```redis
maxmemory 256mb
maxmemory-policy allkeys-lru
```

### Persistence

Enable AOF for job durability:
```redis
appendonly yes
appendfsync everysec
```

### Key Expiration Summary

| Key Type | TTL | Auto-cleanup |
|----------|-----|--------------|
| Completed jobs | 24 hours | BullMQ managed |
| Failed jobs | 7 days | BullMQ managed |
| Rate limit counters | 24 hours | Redis EXPIRE |
| Cache entries | 1-60 minutes | Redis EXPIRE |
| Sessions | 7-30 days | Redis EXPIRE |
| Pub/Sub | N/A | No storage |
