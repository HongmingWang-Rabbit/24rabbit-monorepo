# Multi-Platform Publishing & Rate Limiting

This document describes how agents coordinate publishing to multiple platforms, handle rate limits, and manage partial failures.

## Multi-Platform Publishing Overview

When a schedule targets multiple platforms (e.g., Twitter + LinkedIn + Facebook), the agent must:

1. Generate content (unique per platform or adapted)
2. Create separate PendingPost records per platform
3. Publish to each platform independently
4. Handle partial failures gracefully

## Publishing Coordination

### Job Structure for Multi-Platform

```typescript
// Content generation creates one job per platform
interface GenerateJobData {
  scheduleId: string
  materialId: string
  brandProfileId: string
  platforms: Platform[]          // ["TWITTER", "LINKEDIN", "FACEBOOK"]
  uniquePerPlatform: boolean     // Generate unique content per platform?
  scheduledFor: Date
}

// After generation, separate publish jobs per platform
interface PublishJobData {
  pendingPostId: string
  socialAccountId: string
  platform: Platform
  scheduledFor: Date
  batchId?: string              // Links related multi-platform posts
}
```

### Generation Strategies

#### Unique Per Platform (`uniquePerPlatform: true`)

Each platform gets independently generated content:

```typescript
async function generateUniquePerPlatform(
  material: Material,
  brandProfile: BrandProfile,
  platforms: Platform[]
): Promise<PendingPost[]> {
  const pendingPosts: PendingPost[] = []

  // Generate separately for each platform (can parallelize)
  const generations = await Promise.all(
    platforms.map(platform =>
      generateForPlatform(material, brandProfile, platform)
    )
  )

  for (let i = 0; i < platforms.length; i++) {
    const pendingPost = await prisma.pendingPost.create({
      data: {
        userId: brandProfile.userId,
        brandProfileId: brandProfile.id,
        materialId: material.id,
        platform: platforms[i],
        variations: generations[i].variations,
        batchId: generateBatchId(),  // Links related posts
        // ... other fields
      }
    })
    pendingPosts.push(pendingPost)
  }

  return pendingPosts
}
```

#### Adapted Content (`uniquePerPlatform: false`)

Generate once, adapt for other platforms:

```typescript
async function generateWithAdaptation(
  material: Material,
  brandProfile: BrandProfile,
  platforms: Platform[]
): Promise<PendingPost[]> {
  const batchId = generateBatchId()
  const pendingPosts: PendingPost[] = []

  // Generate for primary platform (longest char limit first)
  const primaryPlatform = getPrimaryPlatform(platforms)
  const primaryGeneration = await generateForPlatform(
    material, brandProfile, primaryPlatform
  )

  // Create primary pending post
  pendingPosts.push(await prisma.pendingPost.create({
    data: {
      platform: primaryPlatform,
      variations: primaryGeneration.variations,
      batchId,
      isPrimary: true,
      // ...
    }
  }))

  // Adapt for other platforms
  for (const platform of platforms.filter(p => p !== primaryPlatform)) {
    const adapted = await adaptContentForPlatform(
      primaryGeneration.variations[0].content,
      primaryPlatform,
      platform,
      brandProfile
    )

    pendingPosts.push(await prisma.pendingPost.create({
      data: {
        platform,
        variations: [adapted],  // Single adapted variation
        batchId,
        isPrimary: false,
        adaptedFrom: primaryPlatform,
        // ...
      }
    }))
  }

  return pendingPosts
}

function getPrimaryPlatform(platforms: Platform[]): Platform {
  // Prefer platform with longest char limit for primary generation
  const priority = ['LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'TWITTER']
  return priority.find(p => platforms.includes(p)) || platforms[0]
}
```

## Publish Job Queuing

### Scheduling Publish Jobs

```typescript
async function queuePublishJobs(pendingPosts: PendingPost[]): Promise<void> {
  for (const post of pendingPosts) {
    // Find the social account for this platform
    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        userId: post.userId,
        platform: post.platform,
        status: 'ACTIVE'
      }
    })

    if (!socialAccount) {
      await markPostFailed(post.id, 'No active social account for platform')
      continue
    }

    // Queue with scheduled delay
    const delay = Math.max(0, post.scheduledFor.getTime() - Date.now())

    await publishQueue.add('publish', {
      pendingPostId: post.id,
      socialAccountId: socialAccount.id,
      platform: post.platform,
      batchId: post.batchId
    }, {
      delay,
      jobId: `publish-${post.id}`,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000
      }
    })
  }
}
```

### Publish Order

When publishing to multiple platforms simultaneously:

```typescript
// Platforms are published independently (no ordering required)
// Each platform has its own queue position and rate limits

// However, for user experience, we track batch completion
async function checkBatchCompletion(batchId: string): Promise<void> {
  const posts = await prisma.pendingPost.findMany({
    where: { batchId }
  })

  const statuses = posts.map(p => p.status)

  if (statuses.every(s => s === 'PUBLISHED')) {
    await notifyBatchComplete(batchId, 'success')
  } else if (statuses.some(s => s === 'FAILED') &&
             statuses.every(s => ['PUBLISHED', 'FAILED'].includes(s))) {
    await notifyBatchComplete(batchId, 'partial_failure')
  }
}
```

## Rate Limiting

### Rate Limit Structure

Rate limits are tracked per social account, not just per platform:

```typescript
interface RateLimitConfig {
  platform: Platform
  limits: {
    postsPerDay: number
    postsPerHour: number
    postsPerMinute: number
  }
}

const RATE_LIMITS: Record<Platform, RateLimitConfig['limits']> = {
  TWITTER: { postsPerDay: 50, postsPerHour: 25, postsPerMinute: 5 },
  FACEBOOK: { postsPerDay: 50, postsPerHour: 25, postsPerMinute: 5 },
  LINKEDIN: { postsPerDay: 100, postsPerHour: 50, postsPerMinute: 10 },
  INSTAGRAM: { postsPerDay: 25, postsPerHour: 10, postsPerMinute: 2 },
  TIKTOK: { postsPerDay: 50, postsPerHour: 20, postsPerMinute: 3 }
}
```

### Redis Rate Limit Keys

```typescript
// Key structure for rate limit tracking
function getRateLimitKeys(socialAccountId: string, platform: Platform): RateLimitKeys {
  const now = new Date()
  const dayKey = format(now, 'yyyy-MM-dd')
  const hourKey = format(now, 'yyyy-MM-dd-HH')
  const minuteKey = format(now, 'yyyy-MM-dd-HH-mm')

  return {
    day: `ratelimit:${platform}:${socialAccountId}:day:${dayKey}`,
    hour: `ratelimit:${platform}:${socialAccountId}:hour:${hourKey}`,
    minute: `ratelimit:${platform}:${socialAccountId}:minute:${minuteKey}`
  }
}

// TTLs for automatic cleanup
const RATE_LIMIT_TTLS = {
  day: 86400,    // 24 hours
  hour: 3600,    // 1 hour
  minute: 60     // 1 minute
}
```

### Rate Limit Check

```typescript
async function checkRateLimit(
  socialAccountId: string,
  platform: Platform
): Promise<RateLimitResult> {
  const keys = getRateLimitKeys(socialAccountId, platform)
  const limits = RATE_LIMITS[platform]

  // Get current counts
  const [dayCount, hourCount, minuteCount] = await Promise.all([
    redis.get(keys.day),
    redis.get(keys.hour),
    redis.get(keys.minute)
  ])

  const counts = {
    day: parseInt(dayCount || '0'),
    hour: parseInt(hourCount || '0'),
    minute: parseInt(minuteCount || '0')
  }

  // Check each limit
  if (counts.minute >= limits.postsPerMinute) {
    return {
      allowed: false,
      reason: 'minute_limit',
      retryAfter: 60 - new Date().getSeconds(),  // Seconds until next minute
      limit: limits.postsPerMinute,
      current: counts.minute
    }
  }

  if (counts.hour >= limits.postsPerHour) {
    return {
      allowed: false,
      reason: 'hour_limit',
      retryAfter: 3600 - (new Date().getMinutes() * 60 + new Date().getSeconds()),
      limit: limits.postsPerHour,
      current: counts.hour
    }
  }

  if (counts.day >= limits.postsPerDay) {
    return {
      allowed: false,
      reason: 'day_limit',
      retryAfter: getSecondsUntilMidnight(),
      limit: limits.postsPerDay,
      current: counts.day
    }
  }

  return { allowed: true, counts }
}
```

### Rate Limit Increment

```typescript
async function incrementRateLimit(
  socialAccountId: string,
  platform: Platform
): Promise<void> {
  const keys = getRateLimitKeys(socialAccountId, platform)
  const ttls = RATE_LIMIT_TTLS

  // Increment all counters atomically
  await redis
    .multi()
    .incr(keys.minute)
    .expire(keys.minute, ttls.minute)
    .incr(keys.hour)
    .expire(keys.hour, ttls.hour)
    .incr(keys.day)
    .expire(keys.day, ttls.day)
    .exec()
}
```

### Rate Limit in Publish Processor

```typescript
async function publishProcessor(job: Job<PublishJobData>): Promise<void> {
  const { pendingPostId, socialAccountId, platform } = job.data

  // 1. Check rate limit before publishing
  const rateLimitResult = await checkRateLimit(socialAccountId, platform)

  if (!rateLimitResult.allowed) {
    logger.warn('Rate limit hit, delaying job', {
      jobId: job.id,
      platform,
      reason: rateLimitResult.reason,
      retryAfter: rateLimitResult.retryAfter
    })

    // Re-queue with delay
    throw new RateLimitError(
      `Rate limit exceeded: ${rateLimitResult.reason}`,
      rateLimitResult.retryAfter * 1000  // Convert to ms
    )
  }

  // 2. Load post and account
  const [pendingPost, socialAccount] = await Promise.all([
    prisma.pendingPost.findUnique({ where: { id: pendingPostId } }),
    prisma.socialAccount.findUnique({ where: { id: socialAccountId } })
  ])

  // 3. Publish to platform
  const connector = getPlatformConnector(platform)
  const result = await connector.publishPost({
    content: pendingPost.finalContent,
    mediaUrls: pendingPost.mediaUrls,
    accessToken: decrypt(socialAccount.accessToken)
  })

  // 4. Increment rate limit counter (after successful publish)
  await incrementRateLimit(socialAccountId, platform)

  // 5. Update records
  await prisma.$transaction([
    prisma.pendingPost.update({
      where: { id: pendingPostId },
      data: { status: 'PUBLISHED', publishedAt: new Date() }
    }),
    prisma.post.create({
      data: {
        pendingPostId,
        userId: pendingPost.userId,
        brandProfileId: pendingPost.brandProfileId,
        socialAccountId,
        platform,
        platformPostId: result.platformPostId,
        content: pendingPost.finalContent,
        publishedAt: new Date()
      }
    })
  ])

  // 6. Check batch completion
  if (pendingPost.batchId) {
    await checkBatchCompletion(pendingPost.batchId)
  }
}
```

### Rate Limit Error Handling

```typescript
// Custom error for rate limiting
class RateLimitError extends Error {
  constructor(message: string, public retryAfterMs: number) {
    super(message)
    this.name = 'RateLimitError'
  }
}

// In worker error handler
worker.on('failed', async (job, err) => {
  if (err instanceof RateLimitError) {
    // Re-queue with calculated delay
    await publishQueue.add('publish', job.data, {
      delay: err.retryAfterMs,
      jobId: `${job.id}-delayed`,
      attempts: job.opts.attempts - job.attemptsMade
    })

    logger.info('Job re-queued after rate limit', {
      originalJobId: job.id,
      delay: err.retryAfterMs
    })
  }
})
```

## Partial Failure Handling

When publishing to multiple platforms, some may succeed while others fail:

### Batch Status Tracking

```typescript
type BatchStatus = 'pending' | 'publishing' | 'success' | 'partial_failure' | 'failed'

async function updateBatchStatus(batchId: string): Promise<BatchStatus> {
  const posts = await prisma.pendingPost.findMany({
    where: { batchId },
    select: { status: true, platform: true }
  })

  const published = posts.filter(p => p.status === 'PUBLISHED').length
  const failed = posts.filter(p => p.status === 'FAILED').length
  const pending = posts.filter(p => ['PENDING', 'APPROVED', 'AUTO_APPROVED'].includes(p.status)).length
  const publishing = posts.filter(p => p.status === 'PUBLISHING').length

  if (publishing > 0) return 'publishing'
  if (pending > 0) return 'pending'
  if (published === posts.length) return 'success'
  if (failed === posts.length) return 'failed'
  if (published > 0 && failed > 0) return 'partial_failure'

  return 'pending'
}
```

### Partial Failure Notification

```typescript
async function notifyPartialFailure(batchId: string): Promise<void> {
  const posts = await prisma.pendingPost.findMany({
    where: { batchId },
    include: { brandProfile: true }
  })

  const succeeded = posts.filter(p => p.status === 'PUBLISHED')
  const failed = posts.filter(p => p.status === 'FAILED')

  await prisma.notification.create({
    data: {
      userId: posts[0].userId,
      type: 'PARTIAL_PUBLISH_FAILURE',
      title: 'Some posts failed to publish',
      message: `Published to ${succeeded.map(p => p.platform).join(', ')} but failed on ${failed.map(p => p.platform).join(', ')}`,
      actionUrl: `/posts/batch/${batchId}`,
      metadata: {
        batchId,
        succeeded: succeeded.map(p => ({ platform: p.platform, id: p.id })),
        failed: failed.map(p => ({ platform: p.platform, id: p.id, reason: p.failureReason }))
      }
    }
  })
}
```

### Retry Failed Platforms

```typescript
async function retryFailedInBatch(batchId: string): Promise<void> {
  const failedPosts = await prisma.pendingPost.findMany({
    where: {
      batchId,
      status: 'FAILED'
    }
  })

  for (const post of failedPosts) {
    // Reset status
    await prisma.pendingPost.update({
      where: { id: post.id },
      data: {
        status: 'APPROVED',
        failureReason: null,
        retryCount: { increment: 1 }
      }
    })

    // Re-queue
    await publishQueue.add('publish', {
      pendingPostId: post.id,
      socialAccountId: post.socialAccountId,
      platform: post.platform,
      batchId: post.batchId,
      isRetry: true
    }, {
      priority: 1  // High priority for retries
    })
  }
}
```

## Platform-Specific Behaviors

### Twitter

```typescript
const twitterBehavior = {
  characterLimit: 280,
  mediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
  maxImages: 4,
  maxVideos: 1,
  videoMaxDuration: 140,  // seconds
  rateLimit: {
    postsPerDay: 50,
    postsPerHour: 25
  },
  features: {
    threads: true,        // Can post threads
    polls: true,          // Can create polls
    scheduling: false     // Must use our scheduler
  },
  errors: {
    187: 'Duplicate content',
    324: 'Media processing failed',
    326: 'Account temporarily locked'
  }
}
```

### LinkedIn

```typescript
const linkedinBehavior = {
  characterLimit: 3000,
  mediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
  maxImages: 20,
  maxVideos: 1,
  videoMaxDuration: 600,  // 10 minutes
  rateLimit: {
    postsPerDay: 100,
    postsPerHour: 50
  },
  features: {
    articles: true,       // Can post long-form articles
    documents: true,      // Can share PDFs
    polls: true
  },
  bestPractices: {
    postingTimes: ['8:00', '12:00', '17:00'],  // Business hours
    hashtagLimit: 5       // Recommended max hashtags
  }
}
```

### Facebook

```typescript
const facebookBehavior = {
  characterLimit: 63206,
  mediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
  maxImages: 10,
  maxVideos: 1,
  videoMaxDuration: 14400,  // 4 hours
  rateLimit: {
    postsPerDay: 50,
    postsPerHour: 25
  },
  features: {
    stories: true,
    reels: true,
    albums: true
  },
  pageVsProfile: 'page_only'  // We only support page posting
}
```

### Instagram

```typescript
const instagramBehavior = {
  characterLimit: 2200,
  mediaTypes: ['image/jpeg', 'image/png', 'video/mp4'],
  maxImages: 10,          // Carousel
  maxVideos: 1,
  videoMaxDuration: 60,   // Reels up to 90s
  aspectRatios: {
    feed: { min: 0.8, max: 1.91 },  // 4:5 to 1.91:1
    stories: { exact: 0.5625 },      // 9:16
    reels: { exact: 0.5625 }         // 9:16
  },
  rateLimit: {
    postsPerDay: 25,
    postsPerHour: 10
  },
  requirements: {
    mediaRequired: true,  // Cannot post text-only
    businessAccount: true // Requires business/creator account
  }
}
```

## Cross-Platform Content Sync

### Handling Platform-Specific Features

```typescript
async function adaptContent(
  content: string,
  sourcePlatform: Platform,
  targetPlatform: Platform,
  options: AdaptOptions
): Promise<AdaptedContent> {
  const sourceLimit = PLATFORM_LIMITS[sourcePlatform].maxChars
  const targetLimit = PLATFORM_LIMITS[targetPlatform].maxChars

  // Expansion (short → long platform)
  if (targetLimit > sourceLimit && content.length < targetLimit * 0.5) {
    return await expandContent(content, targetPlatform, options)
  }

  // Compression (long → short platform)
  if (content.length > targetLimit) {
    return await compressContent(content, targetLimit, options)
  }

  // Minor adjustments
  return {
    content: adjustHashtags(content, targetPlatform),
    adapted: true,
    strategy: 'minor_adjustment'
  }
}

async function compressContent(
  content: string,
  targetLimit: number,
  options: AdaptOptions
): Promise<AdaptedContent> {
  // Try simple truncation first
  if (canTruncateCleanly(content, targetLimit)) {
    return {
      content: truncateAtSentence(content, targetLimit),
      adapted: true,
      strategy: 'truncation'
    }
  }

  // Use AI to compress
  const compressed = await aiAdapter.generateCopy({
    prompt: `Compress this content to under ${targetLimit} characters while preserving the key message:

${content}

Requirements:
- Maximum ${targetLimit} characters
- Keep the main point
- Maintain brand voice
- End with a clear call-to-action if present`,
    maxTokens: Math.ceil(targetLimit / 4)
  })

  return {
    content: compressed.content,
    adapted: true,
    strategy: 'ai_compression'
  }
}
```

## Monitoring & Observability

### Multi-Platform Metrics

```typescript
// Track publishing metrics per platform
const publishMetrics = {
  // Counters
  'publish.attempts': Counter,
  'publish.success': Counter,
  'publish.failure': Counter,
  'publish.rate_limited': Counter,

  // Histograms
  'publish.duration_ms': Histogram,
  'publish.queue_wait_ms': Histogram,

  // Gauges
  'ratelimit.remaining.day': Gauge,
  'ratelimit.remaining.hour': Gauge,

  // Labels
  labels: ['platform', 'social_account_id', 'brand_profile_id']
}

// Log structured publishing events
logger.info('Publish completed', {
  jobId: job.id,
  platform,
  socialAccountId,
  pendingPostId,
  batchId,
  duration: Date.now() - startTime,
  platformPostId: result.platformPostId
})
```

### Rate Limit Dashboard Queries

```sql
-- Current rate limit usage per account
SELECT
  sa.platform,
  sa.username,
  (SELECT COUNT(*) FROM posts WHERE social_account_id = sa.id
   AND published_at > NOW() - INTERVAL '24 hours') as posts_today,
  (SELECT COUNT(*) FROM posts WHERE social_account_id = sa.id
   AND published_at > NOW() - INTERVAL '1 hour') as posts_this_hour
FROM social_accounts sa
WHERE sa.user_id = $1;
```
