/**
 * Analytics Scheduler
 *
 * Runs every hour to collect engagement metrics for recent posts.
 * Uses distributed locking to prevent duplicate execution across worker instances.
 */

import type { Queue } from 'bullmq';
import type { Database } from '@24rabbit/database';
import type { AnalyticsJobData } from '@24rabbit/queue';
import { and, gte, isNotNull } from '@24rabbit/database';
import { posts } from '@24rabbit/database';
import type { SocialPlatform } from '@24rabbit/shared';
import type { DistributedLock } from '../utils/lock';
import type { Logger } from '../utils/logger';
import { config } from '../config';

// =============================================================================
// Types
// =============================================================================

export interface AnalyticsSchedulerDeps {
  db: Database;
  analyticsQueue: Queue<AnalyticsJobData>;
  lock: DistributedLock;
  logger: Logger;
}

export interface AnalyticsScheduler {
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

const LOCK_KEY = 'analytics-scheduler';

// =============================================================================
// Scheduler Factory
// =============================================================================

/**
 * Create the analytics scheduler
 */
export function createAnalyticsScheduler(deps: AnalyticsSchedulerDeps): AnalyticsScheduler {
  const { db, analyticsQueue, lock, logger } = deps;

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isRunning = false;

  return {
    async tick(): Promise<void> {
      // Acquire distributed lock to prevent duplicate execution
      const acquired = await lock.acquire(LOCK_KEY, config.lock.analyticsSchedulerTtl);

      if (!acquired) {
        logger.debug('Analytics scheduler lock not acquired, skipping tick');
        return;
      }

      try {
        logger.debug('Analytics scheduler tick started');
        const startTime = Date.now();

        // Calculate lookback date
        const lookbackDate = new Date();
        lookbackDate.setDate(lookbackDate.getDate() - config.analytics.lookbackDays);

        // Find posts that need analytics collection
        // Prioritize posts that haven't been updated recently
        const recentPosts = await db.query.posts.findMany({
          where: and(
            gte(posts.publishedAt, lookbackDate),
            isNotNull(posts.externalId) // Only posts with platform IDs
          ),
          columns: {
            id: true,
            externalId: true,
            platform: true,
            socialAccountId: true,
            metricsUpdatedAt: true,
            publishedAt: true,
          },
          orderBy: (posts, { asc, desc }) => [
            // Posts that haven't had metrics collected recently come first
            asc(posts.metricsUpdatedAt),
            // Then by recency
            desc(posts.publishedAt),
          ],
          limit: config.analytics.batchSize,
        });

        if (recentPosts.length === 0) {
          logger.debug('No posts need analytics collection');
          return;
        }

        logger.info('Queueing analytics jobs for recent posts', {
          postsCount: recentPosts.length,
          lookbackDays: config.analytics.lookbackDays,
        });

        let jobsQueued = 0;
        const jobsByPlatform: Record<string, number> = {};

        for (const post of recentPosts) {
          // Skip if metrics were updated recently
          if (post.metricsUpdatedAt) {
            const timeSinceUpdate = Date.now() - new Date(post.metricsUpdatedAt).getTime();
            if (timeSinceUpdate < config.analytics.minUpdateIntervalMs) {
              continue;
            }
          }

          try {
            await analyticsQueue.add(
              'collect-analytics',
              {
                postId: post.id,
                platformPostId: post.externalId!,
                platform: post.platform as SocialPlatform,
                socialAccountId: post.socialAccountId,
              },
              {
                jobId: `analytics-${post.id}-${Date.now()}`,
                // Stagger jobs to avoid rate limiting
                delay: jobsQueued * 1000, // 1 second between each
              }
            );

            jobsQueued++;
            const platform = post.platform ?? 'unknown';
            jobsByPlatform[platform] = (jobsByPlatform[platform] ?? 0) + 1;
          } catch (error) {
            logger.error('Failed to queue analytics job', error, {
              postId: post.id,
            });
            // Continue with other posts
          }
        }

        const duration = Date.now() - startTime;

        logger.info('Analytics scheduler tick completed', {
          postsProcessed: recentPosts.length,
          jobsQueued,
          jobsByPlatform,
          duration,
        });
      } finally {
        await lock.release(LOCK_KEY);
      }
    },

    start(intervalMs: number = config.schedulerIntervals.analytics): void {
      if (isRunning) {
        logger.warn('Analytics scheduler already running');
        return;
      }

      isRunning = true;

      // Run immediately on start
      this.tick().catch((error) => {
        logger.error('Analytics scheduler tick failed', error);
      });

      // Then run on interval
      intervalId = setInterval(() => {
        this.tick().catch((error) => {
          logger.error('Analytics scheduler tick failed', error);
        });
      }, intervalMs);

      logger.info('Analytics scheduler started', { intervalMs });
    },

    stop(): void {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      isRunning = false;
      logger.info('Analytics scheduler stopped');
    },
  };
}
