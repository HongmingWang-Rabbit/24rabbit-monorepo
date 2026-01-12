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

## Future Considerations

### Rate Limiting (Not Yet Implemented)

Platform-specific rate limits could use Redis counters:

```
ratelimit:{platform}:{date}    # Daily counter per platform
```

Limits per platform:
- Twitter: 50 posts/day
- LinkedIn: 100 posts/day
- Facebook: 50 posts/day

### Caching (Not Yet Implemented)

Potential caching use cases:
- AI-generated content templates
- Platform API responses
- User session data

### Pub/Sub (Not Yet Implemented)

Real-time notifications could use Redis pub/sub:
- Job completion notifications
- Error alerts
- Analytics updates
