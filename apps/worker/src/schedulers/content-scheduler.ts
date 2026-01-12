/**
 * Content Scheduler
 *
 * Runs every 5 minutes to check for schedules that need content generation.
 * Uses distributed locking to prevent duplicate execution across worker instances.
 */

import type { Queue } from 'bullmq';
import type { Database } from '@24rabbit/database';
import type { GenerateJobData } from '@24rabbit/queue';
import { and, eq, lte, isNull, or, sql } from '@24rabbit/database';
import { schedules, materials, socialAccounts } from '@24rabbit/database';
import type { SocialPlatform } from '@24rabbit/shared';
import type { DistributedLock } from '../utils/lock';
import type { Logger } from '../utils/logger';
import { config } from '../config';

// =============================================================================
// Types
// =============================================================================

export interface ContentSchedulerDeps {
  db: Database;
  generateQueue: Queue<GenerateJobData>;
  lock: DistributedLock;
  logger: Logger;
}

export interface ContentScheduler {
  /**
   * Run a single scheduler tick
   */
  tick(): Promise<void>;

  /**
   * Start the scheduler with interval
   */
  start(intervalMs?: number): void;

  /**
   * Stop the scheduler
   */
  stop(): void;
}

// =============================================================================
// Constants
// =============================================================================

const LOCK_KEY = 'content-scheduler';

// =============================================================================
// Scheduler Factory
// =============================================================================

/**
 * Create the content scheduler
 */
export function createContentScheduler(deps: ContentSchedulerDeps): ContentScheduler {
  const { db, generateQueue, lock, logger } = deps;

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isRunning = false;

  return {
    async tick(): Promise<void> {
      // Acquire distributed lock to prevent duplicate execution
      const acquired = await lock.acquire(LOCK_KEY, config.lock.contentSchedulerTtl);

      if (!acquired) {
        logger.debug('Content scheduler lock not acquired, skipping tick');
        return;
      }

      try {
        logger.debug('Content scheduler tick started');
        const startTime = Date.now();

        // Find schedules that need to run
        const now = new Date();

        const dueSchedules = await db.query.schedules.findMany({
          where: and(
            eq(schedules.isActive, true),
            or(isNull(schedules.nextRunAt), lte(schedules.nextRunAt, now))
          ),
          with: {
            brandProfile: {
              with: {
                socialAccounts: {
                  where: eq(socialAccounts.isActive, true),
                },
              },
            },
          },
        });

        if (dueSchedules.length === 0) {
          logger.debug('No schedules due for content generation');
          return;
        }

        logger.info('Found schedules due for generation', {
          count: dueSchedules.length,
        });

        let jobsQueued = 0;

        for (const schedule of dueSchedules) {
          try {
            // Select material based on strategy
            const material = await selectMaterial(
              db,
              schedule.organizationId,
              schedule.materialSelectionStrategy as
                | 'ROUND_ROBIN'
                | 'RANDOM'
                | 'PRIORITY'
                | 'LEAST_USED'
            );

            if (!material) {
              logger.warn('No available materials for schedule', {
                scheduleId: schedule.id,
                organizationId: schedule.organizationId,
              });
              continue;
            }

            // Get platforms from schedule or brand profile's connected accounts
            const platforms =
              (schedule.platforms as SocialPlatform[]) ??
              schedule.brandProfile.socialAccounts.map((a) => a.platform as SocialPlatform);

            if (platforms.length === 0) {
              logger.warn('No platforms configured for schedule', {
                scheduleId: schedule.id,
              });
              continue;
            }

            // Calculate scheduled publish time based on schedule configuration
            const scheduledFor = calculateNextPublishTime(schedule);

            // Queue generation job
            await generateQueue.add(
              'generate-content',
              {
                scheduleId: schedule.id,
                materialId: material.id,
                brandProfileId: schedule.brandProfileId,
                organizationId: schedule.organizationId,
                platforms,
                scheduledFor: scheduledFor?.toISOString(),
                isManual: false,
              },
              {
                jobId: `gen-${schedule.id}-${Date.now()}`,
              }
            );

            jobsQueued++;

            // Update nextRunAt based on schedule frequency
            const nextRunAt = calculateNextRunAt(schedule);

            await db
              .update(schedules)
              .set({
                nextRunAt,
                updatedAt: new Date(),
              })
              .where(eq(schedules.id, schedule.id));

            logger.debug('Queued generation job for schedule', {
              scheduleId: schedule.id,
              materialId: material.id,
              nextRunAt,
            });
          } catch (error) {
            logger.error('Failed to process schedule', error, {
              scheduleId: schedule.id,
            });
            // Continue with other schedules
          }
        }

        const duration = Date.now() - startTime;

        logger.info('Content scheduler tick completed', {
          schedulesProcessed: dueSchedules.length,
          jobsQueued,
          duration,
        });
      } finally {
        await lock.release(LOCK_KEY);
      }
    },

    start(intervalMs: number = config.schedulerIntervals.content): void {
      if (isRunning) {
        logger.warn('Content scheduler already running');
        return;
      }

      isRunning = true;

      // Run immediately on start
      this.tick().catch((error) => {
        logger.error('Content scheduler tick failed', error);
      });

      // Then run on interval
      intervalId = setInterval(() => {
        this.tick().catch((error) => {
          logger.error('Content scheduler tick failed', error);
        });
      }, intervalMs);

      logger.info('Content scheduler started', { intervalMs });
    },

    stop(): void {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      isRunning = false;
      logger.info('Content scheduler stopped');
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Select a material based on the configured strategy
 */
async function selectMaterial(
  db: Database,
  organizationId: string,
  strategy: 'ROUND_ROBIN' | 'RANDOM' | 'PRIORITY' | 'LEAST_USED'
): Promise<{ id: string } | null> {
  // Base query: ready materials that haven't been used too recently
  const availableMaterials = await db.query.materials.findMany({
    where: and(eq(materials.organizationId, organizationId), eq(materials.status, 'READY')),
    columns: {
      id: true,
      usageCount: true,
      lastUsedAt: true,
      priority: true,
      createdAt: true,
    },
  });

  if (availableMaterials.length === 0) {
    return null;
  }

  let selected: { id: string } | null = null;

  switch (strategy) {
    case 'ROUND_ROBIN':
      // Select oldest unused or least recently used
      selected =
        availableMaterials.sort((a, b) => {
          if (!a.lastUsedAt && b.lastUsedAt) return -1;
          if (a.lastUsedAt && !b.lastUsedAt) return 1;
          if (!a.lastUsedAt && !b.lastUsedAt) {
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          }
          return new Date(a.lastUsedAt!).getTime() - new Date(b.lastUsedAt!).getTime();
        })[0] ?? null;
      break;

    case 'RANDOM':
      // Random selection
      selected = availableMaterials[Math.floor(Math.random() * availableMaterials.length)] ?? null;
      break;

    case 'PRIORITY':
      // Highest priority first, then by creation date
      selected =
        availableMaterials.sort((a, b) => {
          const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
          if (priorityDiff !== 0) return priorityDiff;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        })[0] ?? null;
      break;

    case 'LEAST_USED':
      // Lowest usage count first
      selected =
        availableMaterials.sort((a, b) => {
          return (a.usageCount ?? 0) - (b.usageCount ?? 0);
        })[0] ?? null;
      break;

    default:
      // Default to round robin
      selected = availableMaterials[0] ?? null;
  }

  return selected;
}

/**
 * Calculate the next scheduled publish time
 */
function calculateNextPublishTime(schedule: {
  preferredHours?: number[] | null;
  timezone?: string | null;
}): Date | null {
  // If no preferred hours, publish immediately after approval
  if (!schedule.preferredHours || schedule.preferredHours.length === 0) {
    return null;
  }

  const now = new Date();
  const timezone = schedule.timezone ?? 'UTC';

  // Find the next preferred hour
  // Simplified implementation - in production, use a proper timezone library
  const currentHour = now.getUTCHours();
  const preferredHours = schedule.preferredHours as number[];

  // Sort hours and find next available
  const sortedHours = [...preferredHours].sort((a, b) => a - b);
  const nextHour = sortedHours.find((h) => h > currentHour);

  const scheduledFor = new Date(now);

  if (nextHour !== undefined) {
    // Schedule for later today
    scheduledFor.setUTCHours(nextHour, 0, 0, 0);
  } else {
    // Schedule for first preferred hour tomorrow
    scheduledFor.setUTCDate(scheduledFor.getUTCDate() + 1);
    scheduledFor.setUTCHours(sortedHours[0] ?? 9, 0, 0, 0);
  }

  return scheduledFor;
}

/**
 * Calculate the next run time based on schedule frequency
 */
function calculateNextRunAt(schedule: { frequency: string; frequencyValue?: number | null }): Date {
  const now = new Date();
  const value = schedule.frequencyValue ?? 1;

  switch (schedule.frequency) {
    case 'HOURLY':
      return new Date(now.getTime() + value * 60 * 60 * 1000);

    case 'DAILY':
      return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);

    case 'WEEKLY':
      return new Date(now.getTime() + value * 7 * 24 * 60 * 60 * 1000);

    case 'CUSTOM':
      // For custom, frequencyValue is minutes
      return new Date(now.getTime() + value * 60 * 1000);

    default:
      // Default to daily
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}
