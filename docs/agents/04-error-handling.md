# Error Handling & Recovery

This document describes how agents handle errors, implement retry strategies, manage dead letter queues, and recover from failures.

## Error Classification

Errors are classified to determine the appropriate handling strategy:

### Retryable Errors

Temporary failures that may succeed on retry:

| Error Type | Examples | Strategy |
|------------|----------|----------|
| Network Timeout | AI API timeout, platform API timeout | Retry with backoff |
| Rate Limited | AI quota exceeded, platform rate limit | Retry with delay |
| Service Unavailable | 503 errors, maintenance windows | Retry with backoff |
| Connection Reset | TCP connection dropped | Immediate retry |
| Temporary Auth Failure | Token refresh needed | Refresh then retry |

### Non-Retryable Errors

Permanent failures that won't succeed on retry:

| Error Type | Examples | Strategy |
|------------|----------|----------|
| Invalid Input | Malformed data, missing required fields | Fail immediately |
| Authentication Failed | Invalid API key, revoked token | Fail and notify |
| Content Violation | Platform content policy rejection | Fail and notify |
| Resource Not Found | Deleted material, removed account | Fail immediately |
| Quota Exhausted | No credits remaining | Fail and notify |

### Classification Logic

```typescript
function classifyError(error: Error): ErrorClassification {
  // Network/timeout errors - retryable
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
    return { retryable: true, category: 'network' }
  }

  // Rate limiting - retryable with delay
  if (error.status === 429) {
    const retryAfter = error.headers?.['retry-after'] || 60
    return { retryable: true, category: 'rate_limit', delayMs: retryAfter * 1000 }
  }

  // Service unavailable - retryable
  if (error.status === 503 || error.status === 502) {
    return { retryable: true, category: 'service_unavailable' }
  }

  // Auth errors - may be retryable if token can be refreshed
  if (error.status === 401) {
    return { retryable: true, category: 'auth', action: 'refresh_token' }
  }

  // Client errors - not retryable
  if (error.status >= 400 && error.status < 500) {
    return { retryable: false, category: 'client_error' }
  }

  // Default - assume retryable for unknown errors
  return { retryable: true, category: 'unknown' }
}
```

## Retry Strategy

### Exponential Backoff

```typescript
const DEFAULT_RETRY_CONFIG = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,      // Base delay: 1 second
    maxDelay: 30000   // Max delay: 30 seconds
  }
}

// Retry delays: 1s → 2s → 4s (capped at 30s)
function calculateBackoff(attempt: number, config: RetryConfig): number {
  const delay = config.delay * Math.pow(2, attempt - 1)
  return Math.min(delay, config.maxDelay)
}
```

### Per-Job Type Configuration

| Job Type | Max Attempts | Base Delay | Max Delay |
|----------|--------------|------------|-----------|
| Content Analysis | 3 | 1s | 30s |
| Content Generation | 3 | 2s | 60s |
| Publishing | 5 | 1s | 30s |
| Analytics | 3 | 5s | 60s |

### Retry Implementation

```typescript
async function processWithRetry<T>(
  job: Job,
  processor: (job: Job) => Promise<T>
): Promise<T> {
  try {
    return await processor(job)
  } catch (error) {
    const classification = classifyError(error)

    if (!classification.retryable) {
      // Log and fail permanently
      await logPermanentFailure(job, error)
      throw error
    }

    // Check if we have retries remaining
    if (job.attemptsMade >= job.opts.attempts) {
      await moveToDLQ(job, error)
      throw error
    }

    // Throw to trigger BullMQ retry
    throw error
  }
}
```

## Dead Letter Queue (DLQ)

Jobs that fail all retry attempts are moved to a dead letter queue for investigation.

### DLQ Structure

```typescript
interface DeadLetterEntry {
  id: string
  originalQueue: string
  jobId: string
  jobData: any
  error: {
    message: string
    stack: string
    code?: string
  }
  attempts: number
  failedAt: Date
  lastAttemptAt: Date
  status: 'pending' | 'investigating' | 'resolved' | 'discarded'
  resolution?: {
    action: string
    resolvedAt: Date
    resolvedBy: string
  }
}
```

### DLQ Operations

```typescript
// Move failed job to DLQ
async function moveToDLQ(job: Job, error: Error) {
  await prisma.deadLetterQueue.create({
    data: {
      originalQueue: job.queueName,
      jobId: job.id,
      jobData: job.data,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      attempts: job.attemptsMade,
      failedAt: new Date(),
      lastAttemptAt: new Date(),
      status: 'pending'
    }
  })

  // Notify about DLQ entry
  await notifyDLQEntry(job, error)
}

// Retry a DLQ entry
async function retryDLQEntry(dlqId: string) {
  const entry = await prisma.deadLetterQueue.findUnique({
    where: { id: dlqId }
  })

  // Re-queue the job
  const queue = getQueue(entry.originalQueue)
  await queue.add(entry.jobData.type, entry.jobData, {
    attempts: 3,  // Fresh retry count
    jobId: `retry-${entry.jobId}-${Date.now()}`
  })

  // Mark as resolved
  await prisma.deadLetterQueue.update({
    where: { id: dlqId },
    data: {
      status: 'resolved',
      resolution: {
        action: 'retried',
        resolvedAt: new Date()
      }
    }
  })
}

// Discard a DLQ entry (won't retry)
async function discardDLQEntry(dlqId: string, reason: string) {
  await prisma.deadLetterQueue.update({
    where: { id: dlqId },
    data: {
      status: 'discarded',
      resolution: {
        action: 'discarded',
        reason: reason,
        resolvedAt: new Date()
      }
    }
  })
}
```

## Failure Notifications

### User-Facing Notifications

When failures affect user content:

```typescript
async function notifyUserOfFailure(
  userId: string,
  failureType: string,
  details: FailureDetails
) {
  // In-app notification
  await prisma.notification.create({
    data: {
      userId,
      type: 'PUBLISHING_FAILED',
      title: 'Content failed to publish',
      message: `Your ${details.platform} post could not be published. ${details.userFriendlyReason}`,
      actionUrl: `/posts/${details.pendingPostId}`,
      read: false
    }
  })

  // Email notification (if enabled)
  if (details.sendEmail) {
    await emailService.send({
      to: details.userEmail,
      subject: '[24Rabbit] Publishing failed - action required',
      template: 'publishing-failed',
      data: {
        platform: details.platform,
        reason: details.userFriendlyReason,
        actionUrl: `${APP_URL}/posts/${details.pendingPostId}`,
        supportUrl: `${APP_URL}/support`
      }
    })
  }
}
```

### User-Friendly Error Messages

```typescript
const USER_FRIENDLY_MESSAGES = {
  'auth_expired': 'Your connection to {platform} has expired. Please reconnect your account.',
  'rate_limited': 'Too many posts today. Your content will be published when the limit resets.',
  'content_rejected': '{platform} rejected this content. Please review and try different wording.',
  'media_failed': 'The image/video could not be uploaded. Please try a different file.',
  'account_suspended': 'Your {platform} account appears to be suspended. Please check your account status.',
  'unknown': 'Something went wrong. Our team has been notified and is investigating.'
}

function getUserFriendlyMessage(errorCode: string, platform: string): string {
  const template = USER_FRIENDLY_MESSAGES[errorCode] || USER_FRIENDLY_MESSAGES.unknown
  return template.replace('{platform}', platform)
}
```

### Operator Notifications

For system-level failures:

```typescript
async function notifyOperators(severity: 'warning' | 'error' | 'critical', details: AlertDetails) {
  // Log to monitoring system
  logger.log(severity, 'System alert', details)

  // Alert channels based on severity
  if (severity === 'critical') {
    await sendSlackAlert('#incidents', details)
    await sendPagerDutyAlert(details)
  } else if (severity === 'error') {
    await sendSlackAlert('#alerts', details)
  }
  // Warnings are logged only
}
```

## Recovery Procedures

### Token Refresh Recovery

When OAuth tokens expire:

```typescript
async function handleAuthError(
  job: Job,
  socialAccountId: string,
  error: AuthError
): Promise<void> {
  const socialAccount = await prisma.socialAccount.findUnique({
    where: { id: socialAccountId }
  })

  try {
    // Attempt token refresh
    const connector = getPlatformConnector(socialAccount.platform)
    const newTokens = await connector.refreshToken(
      decrypt(socialAccount.refreshToken)
    )

    // Update stored tokens
    await prisma.socialAccount.update({
      where: { id: socialAccountId },
      data: {
        accessToken: encrypt(newTokens.accessToken),
        refreshToken: encrypt(newTokens.refreshToken),
        tokenExpiresAt: newTokens.expiresAt
      }
    })

    // Re-queue the original job
    await job.retry()
  } catch (refreshError) {
    // Refresh failed - mark account as needing reconnection
    await prisma.socialAccount.update({
      where: { id: socialAccountId },
      data: {
        status: 'NEEDS_RECONNECT',
        lastError: refreshError.message
      }
    })

    // Notify user to reconnect
    await notifyReconnectNeeded(socialAccount)

    throw refreshError
  }
}
```

### Publishing Failure Recovery

When publishing fails after all retries:

```typescript
async function handlePublishingFailure(
  pendingPostId: string,
  error: Error
): Promise<void> {
  // Update pending post status
  await prisma.pendingPost.update({
    where: { id: pendingPostId },
    data: {
      status: 'FAILED',
      failedAt: new Date(),
      failureReason: error.message
    }
  })

  const pendingPost = await prisma.pendingPost.findUnique({
    where: { id: pendingPostId },
    include: { brandProfile: true }
  })

  // Determine recovery options based on error type
  const errorClass = classifyError(error)

  switch (errorClass.category) {
    case 'auth':
      // Offer to retry after reconnecting account
      await notifyUserOfFailure(pendingPost.userId, 'auth_expired', {
        platform: pendingPost.platform,
        pendingPostId,
        canRetry: true,
        action: 'reconnect_account'
      })
      break

    case 'content_policy':
      // Content rejected - user must edit
      await notifyUserOfFailure(pendingPost.userId, 'content_rejected', {
        platform: pendingPost.platform,
        pendingPostId,
        canRetry: false,
        action: 'edit_content'
      })
      break

    case 'rate_limit':
      // Auto-reschedule for later
      const newScheduledFor = addHours(new Date(), 1)
      await prisma.pendingPost.update({
        where: { id: pendingPostId },
        data: {
          status: pendingPost.status === 'AUTO_APPROVED' ? 'AUTO_APPROVED' : 'APPROVED',
          scheduledFor: newScheduledFor,
          failureReason: null
        }
      })
      break

    default:
      // Unknown error - allow manual retry
      await notifyUserOfFailure(pendingPost.userId, 'unknown', {
        platform: pendingPost.platform,
        pendingPostId,
        canRetry: true,
        action: 'retry'
      })
  }
}
```

### Manual Retry Endpoint

```typescript
// API endpoint for manual retry
async function retryFailedPost(pendingPostId: string, userId: string) {
  const pendingPost = await prisma.pendingPost.findUnique({
    where: { id: pendingPostId }
  })

  // Verify ownership
  if (pendingPost.userId !== userId) {
    throw new ForbiddenError('Not authorized')
  }

  // Verify can be retried
  if (pendingPost.status !== 'FAILED') {
    throw new BadRequestError('Post is not in failed status')
  }

  // Reset status and re-queue
  await prisma.pendingPost.update({
    where: { id: pendingPostId },
    data: {
      status: 'APPROVED',
      failureReason: null,
      retryCount: { increment: 1 }
    }
  })

  await publishQueue.add('publish', {
    pendingPostId,
    isRetry: true
  }, {
    priority: 1  // High priority for retries
  })

  return { success: true, message: 'Retry queued' }
}
```

## Circuit Breaker

Prevent cascading failures when external services are down.

### Implementation

```typescript
class CircuitBreaker {
  private failures: number = 0
  private lastFailure: Date | null = null
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private readonly threshold: number = 5,
    private readonly resetTimeout: number = 60000  // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if we should try half-open
      if (Date.now() - this.lastFailure.getTime() > this.resetTimeout) {
        this.state = 'half-open'
      } else {
        throw new CircuitOpenError('Circuit breaker is open')
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failures = 0
    this.state = 'closed'
  }

  private onFailure() {
    this.failures++
    this.lastFailure = new Date()

    if (this.failures >= this.threshold) {
      this.state = 'open'
      logger.warn('Circuit breaker opened', {
        failures: this.failures,
        threshold: this.threshold
      })
    }
  }
}
```

### Usage

```typescript
// One circuit breaker per external service
const aiCircuitBreaker = new CircuitBreaker(5, 60000)
const facebookCircuitBreaker = new CircuitBreaker(5, 60000)
const twitterCircuitBreaker = new CircuitBreaker(3, 30000)

// In job processor
async function generateContent(job: Job) {
  try {
    return await aiCircuitBreaker.execute(() =>
      aiAdapter.generateCopy(job.data)
    )
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      // Don't retry, wait for circuit to reset
      throw new Error('AI service temporarily unavailable')
    }
    throw error
  }
}
```

## Logging Standards

### Structured Logging

```typescript
// Log entry structure
interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context: {
    jobId?: string
    jobType?: string
    userId?: string
    brandProfileId?: string
    platform?: string
    duration?: number
  }
  error?: {
    message: string
    code?: string
    stack?: string
  }
}
```

### Logging Examples

```typescript
// Job started
logger.info('Processing job', {
  jobId: job.id,
  jobType: 'content:generate',
  brandProfileId: data.brandProfileId,
  platform: data.platform
})

// External API call
logger.debug('Calling AI adapter', {
  jobId: job.id,
  adapter: 'gemini',
  operation: 'generateCopy',
  promptLength: prompt.length
})

// Job completed
logger.info('Job completed', {
  jobId: job.id,
  jobType: 'content:generate',
  duration: Date.now() - startTime,
  variationsGenerated: 3
})

// Error occurred
logger.error('Job failed', {
  jobId: job.id,
  jobType: 'post:publish',
  error: {
    message: error.message,
    code: error.code,
    stack: error.stack
  },
  attempt: job.attemptsMade,
  willRetry: job.attemptsMade < job.opts.attempts
})
```

## Monitoring Alerts

### Alert Thresholds

| Metric | Warning | Error | Critical |
|--------|---------|-------|----------|
| Job failure rate | > 5% | > 10% | > 25% |
| Queue depth | > 500 | > 1000 | > 5000 |
| Processing latency | > 30s | > 60s | > 120s |
| DLQ entries (hourly) | > 5 | > 20 | > 50 |
| Circuit breaker opens | - | 1 | 3+ |

### Alert Response Procedures

```typescript
const ALERT_PROCEDURES = {
  high_failure_rate: [
    'Check recent deployments for bugs',
    'Verify external service status (AI provider, platforms)',
    'Review error logs for patterns',
    'Check for rate limiting issues'
  ],
  queue_backup: [
    'Check worker health and count',
    'Scale up workers if needed',
    'Check for stuck jobs',
    'Verify Redis connectivity'
  ],
  high_latency: [
    'Check AI provider response times',
    'Review job complexity/size',
    'Check database query performance',
    'Consider increasing concurrency'
  ],
  circuit_breaker_open: [
    'Identify affected service',
    'Check service status page',
    'Contact service provider if needed',
    'Monitor for auto-recovery'
  ]
}
```

## Credit Refunds

Credits are refunded when failures are not the user's fault:

```typescript
async function handleCreditRefund(
  userId: string,
  jobType: string,
  error: Error
): Promise<void> {
  const errorClass = classifyError(error)

  // Refund for system failures, not user errors
  const shouldRefund = [
    'network',
    'service_unavailable',
    'rate_limit',
    'unknown'
  ].includes(errorClass.category)

  if (shouldRefund) {
    const creditCost = CREDIT_COSTS[jobType]

    await prisma.creditTransaction.create({
      data: {
        userId,
        amount: creditCost,
        type: 'REFUND',
        reason: `Refund for failed ${jobType}: ${error.message}`
      }
    })

    await prisma.subscription.update({
      where: { userId },
      data: {
        currentCredits: { increment: creditCost }
      }
    })

    logger.info('Credits refunded', {
      userId,
      amount: creditCost,
      reason: jobType
    })
  }
}
```

## Graceful Degradation

When services are degraded, continue operating with reduced functionality:

### AI Provider Fallback

```typescript
async function generateWithFallback(params: GenerateParams): Promise<GeneratedContent> {
  // Try primary provider
  try {
    return await primaryAIAdapter.generateCopy(params)
  } catch (primaryError) {
    logger.warn('Primary AI provider failed, trying fallback', {
      error: primaryError.message
    })

    // Try fallback provider
    try {
      return await fallbackAIAdapter.generateCopy(params)
    } catch (fallbackError) {
      // Both failed
      throw new Error('All AI providers unavailable')
    }
  }
}
```

### Feature Degradation

```typescript
// When embedding service is down, skip similarity check
async function generateContent(job: Job): Promise<void> {
  const canCheckSimilarity = await healthCheck.isHealthy('embedding-service')

  if (!canCheckSimilarity) {
    logger.warn('Similarity check skipped - embedding service unavailable', {
      jobId: job.id
    })
    // Continue without similarity check
    // May result in more similar content, but doesn't block publishing
  } else {
    await checkSimilarity(job.data)
  }

  // Continue with generation...
}
```
