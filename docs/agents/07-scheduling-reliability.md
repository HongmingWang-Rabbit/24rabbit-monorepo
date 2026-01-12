# Scheduling Reliability

This document describes how the scheduling system ensures reliable execution, handles edge cases, and recovers from failures.

## Scheduler Architecture

The scheduler runs as a cron job that:

1. Queries active schedules due for execution
2. Selects materials and generates content
3. Updates next run times
4. Handles missed executions

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCHEDULER EXECUTION FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Every 5 Minutes]                                               │
│         │                                                         │
│         ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 1. ACQUIRE SCHEDULER LOCK                                   │ │
│  │    Redis: SET scheduler:lock {workerId} NX EX 300           │ │
│  │    (Prevents duplicate execution across workers)            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│         │                                                         │
│         ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 2. QUERY DUE SCHEDULES                                      │ │
│  │    WHERE isActive = true AND nextRunAt <= NOW()             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│         │                                                         │
│         ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 3. FOR EACH SCHEDULE                                        │ │
│  │    - Lock schedule row (SELECT FOR UPDATE)                  │ │
│  │    - Select material                                        │ │
│  │    - Queue generation job                                   │ │
│  │    - Calculate and update nextRunAt                         │ │
│  │    - Release row lock                                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│         │                                                         │
│         ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 4. RELEASE SCHEDULER LOCK                                   │ │
│  │    Redis: DEL scheduler:lock                                │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Duplicate Execution Prevention

### Distributed Lock

Prevents multiple worker instances from running the scheduler simultaneously:

```typescript
async function acquireSchedulerLock(workerId: string): Promise<boolean> {
  const lockKey = 'scheduler:lock'
  const lockTTL = 300  // 5 minutes

  // SET NX (only if not exists) with expiry
  const acquired = await redis.set(lockKey, workerId, 'NX', 'EX', lockTTL)

  return acquired === 'OK'
}

async function releaseSchedulerLock(workerId: string): Promise<void> {
  const lockKey = 'scheduler:lock'

  // Only release if we own the lock (Lua script for atomicity)
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `

  await redis.eval(script, 1, lockKey, workerId)
}
```

### Row-Level Locking

Prevents race conditions on individual schedule updates:

```typescript
async function processSchedule(scheduleId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Lock the schedule row
    const schedule = await tx.$queryRaw`
      SELECT * FROM schedules
      WHERE id = ${scheduleId}
      FOR UPDATE SKIP LOCKED
    `

    if (!schedule) {
      // Already being processed by another worker
      return
    }

    // Process the schedule
    await executeSchedule(schedule, tx)

    // Update next run time
    await tx.schedule.update({
      where: { id: scheduleId },
      data: { nextRunAt: calculateNextRunAt(schedule) }
    })
  })
}
```

### Idempotency Keys

Ensure jobs are only queued once per execution window:

```typescript
async function queueGenerationJob(
  schedule: Schedule,
  material: Material
): Promise<void> {
  // Create idempotency key based on schedule + time window
  const windowStart = getScheduleWindowStart(schedule)
  const idempotencyKey = `gen:${schedule.id}:${windowStart.toISOString()}`

  // Check if already queued
  const existing = await redis.get(idempotencyKey)
  if (existing) {
    logger.info('Skipping duplicate generation', {
      scheduleId: schedule.id,
      idempotencyKey
    })
    return
  }

  // Queue the job
  await contentGenerateQueue.add('generate', {
    scheduleId: schedule.id,
    materialId: material.id,
    brandProfileId: schedule.brandProfileId,
    platforms: schedule.platforms
  }, {
    jobId: idempotencyKey  // Use as job ID for deduplication
  })

  // Mark as queued (TTL = 1 hour)
  await redis.set(idempotencyKey, 'queued', 'EX', 3600)
}
```

## Time Zone Handling

### Schedule Configuration

```typescript
interface Schedule {
  id: string
  times: string[]           // ["09:00", "17:00"] in local time
  timezone: string          // "America/Vancouver", "Europe/London"
  daysOfWeek: number[]      // [1,2,3,4,5] = Mon-Fri
  nextRunAt: Date           // UTC timestamp
}
```

### Next Run Calculation

```typescript
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz'

function calculateNextRunAt(schedule: Schedule): Date {
  const now = new Date()
  const timezone = schedule.timezone

  // Convert current UTC to schedule's timezone
  const localNow = utcToZonedTime(now, timezone)

  // Find next valid time slot
  let candidate = findNextTimeSlot(localNow, schedule.times, schedule.daysOfWeek)

  // Convert back to UTC for storage
  return zonedTimeToUtc(candidate, timezone)
}

function findNextTimeSlot(
  localNow: Date,
  times: string[],
  daysOfWeek: number[]
): Date {
  // Sort times chronologically
  const sortedTimes = [...times].sort()

  // Check each day starting from today
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const candidate = addDays(localNow, dayOffset)
    const dayOfWeek = getDay(candidate)

    // Skip if not a scheduled day
    if (!daysOfWeek.includes(dayOfWeek)) continue

    // Check each time slot
    for (const timeStr of sortedTimes) {
      const [hours, minutes] = timeStr.split(':').map(Number)
      const slotTime = setMinutes(setHours(candidate, hours), minutes)

      // If this slot is in the future, use it
      if (dayOffset > 0 || slotTime > localNow) {
        return slotTime
      }
    }
  }

  // Fallback: next occurrence of first time on first valid day
  throw new Error('Could not calculate next run time')
}
```

### Daylight Saving Time

DST transitions require special handling:

```typescript
function calculateNextRunAtWithDST(schedule: Schedule): Date {
  const timezone = schedule.timezone
  const candidateLocal = findNextTimeSlot(...)

  // Check for DST transition
  const candidateUtc = zonedTimeToUtc(candidateLocal, timezone)
  const verifyLocal = utcToZonedTime(candidateUtc, timezone)

  // If hours don't match, we hit a DST boundary
  if (getHours(candidateLocal) !== getHours(verifyLocal)) {
    // DST "spring forward" - time doesn't exist
    if (getHours(verifyLocal) > getHours(candidateLocal)) {
      // Skip to the next hour
      return addHours(candidateUtc, 1)
    }

    // DST "fall back" - time occurs twice
    // Use the first occurrence (standard behavior)
  }

  return candidateUtc
}
```

### DST Edge Cases

| Scenario | Scheduled Time | Behavior |
|----------|----------------|----------|
| Spring Forward (2:00 AM → 3:00 AM) | 2:30 AM | Skip to 3:00 AM |
| Fall Back (2:00 AM occurs twice) | 2:30 AM | Use first occurrence |
| Cross-timezone users | Any time | All times stored in UTC |

## Missed Execution Recovery

When the scheduler misses an execution (downtime, high load), it must recover gracefully.

### Detection

```typescript
async function detectMissedExecutions(): Promise<Schedule[]> {
  const missedThreshold = subMinutes(new Date(), 10)  // 10 min grace period

  return await prisma.schedule.findMany({
    where: {
      isActive: true,
      nextRunAt: {
        lt: missedThreshold  // More than 10 minutes overdue
      }
    }
  })
}
```

### Recovery Strategies

```typescript
enum MissedExecutionStrategy {
  SKIP = 'skip',           // Skip missed, schedule next
  EXECUTE_ONCE = 'once',   // Execute once, then schedule next
  EXECUTE_ALL = 'all'      // Execute all missed (risky)
}

async function handleMissedExecution(
  schedule: Schedule,
  strategy: MissedExecutionStrategy
): Promise<void> {
  const missedCount = countMissedExecutions(schedule)

  switch (strategy) {
    case MissedExecutionStrategy.SKIP:
      // Just update to next valid time
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          nextRunAt: calculateNextRunAt(schedule),
          missedExecutions: { increment: missedCount }
        }
      })
      logger.warn('Skipped missed executions', {
        scheduleId: schedule.id,
        missedCount
      })
      break

    case MissedExecutionStrategy.EXECUTE_ONCE:
      // Execute once (as if just triggered)
      await executeSchedule(schedule)
      // Then schedule next
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          nextRunAt: calculateNextRunAt(schedule),
          missedExecutions: { increment: missedCount - 1 }
        }
      })
      break

    case MissedExecutionStrategy.EXECUTE_ALL:
      // Execute for each missed slot (use carefully!)
      for (let i = 0; i < missedCount; i++) {
        await executeSchedule(schedule)
      }
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: { nextRunAt: calculateNextRunAt(schedule) }
      })
      break
  }
}

function countMissedExecutions(schedule: Schedule): number {
  const now = new Date()
  const lastRun = schedule.lastRunAt || schedule.createdAt
  let count = 0
  let check = lastRun

  while (check < now) {
    check = calculateNextRunAtFrom(schedule, check)
    if (check < now) count++
  }

  return count
}
```

### Default Recovery Behavior

```typescript
// Configuration
const MISSED_EXECUTION_CONFIG = {
  strategy: MissedExecutionStrategy.EXECUTE_ONCE,
  maxMissedToRecover: 3,      // Don't execute more than 3 missed
  alertThreshold: 5,          // Alert if > 5 missed
  graceMinutes: 10            // Consider missed after 10 min
}

async function recoverMissedSchedules(): Promise<void> {
  const missed = await detectMissedExecutions()

  for (const schedule of missed) {
    const missedCount = countMissedExecutions(schedule)

    if (missedCount > MISSED_EXECUTION_CONFIG.alertThreshold) {
      await alertOperators('high_missed_executions', {
        scheduleId: schedule.id,
        missedCount,
        lastRunAt: schedule.lastRunAt
      })
    }

    // Cap recovery to prevent flood
    const effectiveMissed = Math.min(
      missedCount,
      MISSED_EXECUTION_CONFIG.maxMissedToRecover
    )

    if (effectiveMissed > 0) {
      await handleMissedExecution(
        schedule,
        MISSED_EXECUTION_CONFIG.strategy
      )
    }
  }
}
```

## Frequency Configurations

### Preset Frequencies

```typescript
type FrequencyPreset = '1_per_day' | '2_per_day' | '3_per_day' | 'weekly' | 'custom'

const FREQUENCY_PRESETS: Record<FrequencyPreset, FrequencyConfig> = {
  '1_per_day': {
    times: ['10:00'],
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0]  // Every day
  },
  '2_per_day': {
    times: ['09:00', '17:00'],
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0]
  },
  '3_per_day': {
    times: ['08:00', '12:00', '18:00'],
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0]
  },
  'weekly': {
    times: ['10:00'],
    daysOfWeek: [1]  // Monday only
  },
  'custom': {
    // User-defined times and days
  }
}
```

### Custom Frequency Validation

```typescript
function validateScheduleConfig(config: ScheduleConfig): ValidationResult {
  const errors: string[] = []

  // Validate times
  for (const time of config.times) {
    if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      errors.push(`Invalid time format: ${time}`)
    }
  }

  // Validate days
  for (const day of config.daysOfWeek) {
    if (day < 0 || day > 6) {
      errors.push(`Invalid day of week: ${day}`)
    }
  }

  // Validate timezone
  try {
    Intl.DateTimeFormat('en-US', { timeZone: config.timezone })
  } catch {
    errors.push(`Invalid timezone: ${config.timezone}`)
  }

  // Validate minimum frequency (prevent spam)
  const dailyPosts = config.times.length * config.daysOfWeek.length / 7
  if (dailyPosts > 10) {
    errors.push('Maximum 10 posts per day allowed')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
```

## Schedule State Management

### Schedule Status

```typescript
enum ScheduleStatus {
  ACTIVE = 'active',       // Running normally
  PAUSED = 'paused',       // Manually paused by user
  EXHAUSTED = 'exhausted', // No materials available
  ERROR = 'error'          // Recurring errors
}
```

### Auto-Pause on Errors

```typescript
const ERROR_THRESHOLD = 5  // Consecutive errors before pause

async function handleScheduleError(
  schedule: Schedule,
  error: Error
): Promise<void> {
  const consecutiveErrors = schedule.consecutiveErrors + 1

  if (consecutiveErrors >= ERROR_THRESHOLD) {
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        status: 'ERROR',
        consecutiveErrors,
        lastError: error.message,
        pausedAt: new Date(),
        pauseReason: `Auto-paused after ${consecutiveErrors} consecutive errors`
      }
    })

    await notifyUser(schedule.userId, {
      type: 'SCHEDULE_PAUSED',
      message: `Schedule paused due to repeated errors: ${error.message}`,
      actionUrl: `/schedules/${schedule.id}`
    })
  } else {
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        consecutiveErrors,
        lastError: error.message
      }
    })
  }
}

async function handleScheduleSuccess(schedule: Schedule): Promise<void> {
  // Reset error counter on success
  if (schedule.consecutiveErrors > 0) {
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        consecutiveErrors: 0,
        lastError: null
      }
    })
  }
}
```

### Material Exhaustion

```typescript
async function checkMaterialAvailability(schedule: Schedule): Promise<boolean> {
  const availableMaterials = await prisma.material.count({
    where: {
      brandProfileId: schedule.brandProfileId,
      status: 'READY',
      lastUsedAt: {
        lt: subDays(new Date(), 7)  // Cooldown period
      }
    }
  })

  if (availableMaterials === 0) {
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        status: 'EXHAUSTED',
        pausedAt: new Date(),
        pauseReason: 'No materials available'
      }
    })

    await notifyUser(schedule.userId, {
      type: 'MATERIALS_EXHAUSTED',
      message: 'Upload more materials to continue automated posting',
      actionUrl: `/materials/upload`
    })

    return false
  }

  return true
}
```

## Scheduler Monitoring

### Health Metrics

```typescript
const schedulerMetrics = {
  // Execution metrics
  'scheduler.run.duration_ms': Histogram,
  'scheduler.schedules.processed': Counter,
  'scheduler.schedules.skipped': Counter,
  'scheduler.schedules.failed': Counter,

  // Schedule health
  'scheduler.schedules.active': Gauge,
  'scheduler.schedules.paused': Gauge,
  'scheduler.schedules.exhausted': Gauge,
  'scheduler.schedules.error': Gauge,

  // Missed execution tracking
  'scheduler.missed.detected': Counter,
  'scheduler.missed.recovered': Counter
}
```

### Alert Conditions

| Condition | Severity | Action |
|-----------|----------|--------|
| Scheduler lock held > 10 min | Error | Force release lock, investigate |
| > 10 schedules missed | Warning | Check system health |
| Scheduler not running | Critical | Page on-call |
| > 50% schedules in error | Error | Investigate common cause |

### Scheduler Logs

```typescript
// Structured logging for scheduler runs
logger.info('Scheduler run started', {
  workerId,
  timestamp: new Date().toISOString()
})

logger.info('Scheduler run completed', {
  workerId,
  duration: Date.now() - startTime,
  processed: processedCount,
  skipped: skippedCount,
  failed: failedCount,
  missed: missedRecovered
})
```

## Testing Considerations

### Time-Based Testing

```typescript
// Use dependency injection for time
class Scheduler {
  constructor(private clock: Clock = new SystemClock()) {}

  async run(): Promise<void> {
    const now = this.clock.now()
    // ... use now instead of new Date()
  }
}

// In tests
const mockClock = new MockClock('2025-03-09T01:30:00Z')  // DST transition
const scheduler = new Scheduler(mockClock)
await scheduler.run()
mockClock.advance(hours(2))  // Simulate DST spring forward
await scheduler.run()
```

### Chaos Testing

```typescript
// Simulate failures
const chaosTests = [
  'scheduler_lock_stuck',      // Lock never released
  'database_slow',             // Slow query responses
  'redis_timeout',             // Redis connection fails
  'clock_skew',                // System clock drifts
  'worker_crash_mid_run'       // Worker dies during execution
]
```
