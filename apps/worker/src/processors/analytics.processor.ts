/**
 * Analytics Processor
 *
 * Fetches engagement metrics from social platforms and updates post records.
 * Triggered by the hourly analytics scheduler.
 */

import type { Job } from 'bullmq';
import type { AnalyticsJobData } from '@24rabbit/queue';
import type { Database } from '@24rabbit/database';
import { eq, sql } from '@24rabbit/database';
import { posts, socialAccounts } from '@24rabbit/database';
import { decrypt } from '@24rabbit/shared';
import type { PlatformService } from '../services/platform.service';
import type { Logger } from '../utils/logger';
import { classifyError } from '../utils/errors';

// =============================================================================
// Types
// =============================================================================

export interface AnalyticsProcessorDeps {
  db: Database;
  platformService: PlatformService;
  logger: Logger;
  encryptionKey: string;
}

// =============================================================================
// Processor Factory
// =============================================================================

/**
 * Create the analytics processor function
 */
export function createAnalyticsProcessor(deps: AnalyticsProcessorDeps) {
  const { db, platformService, logger, encryptionKey } = deps;

  return async (job: Job<AnalyticsJobData>): Promise<void> => {
    const { postId, platformPostId, platform, socialAccountId } = job.data;
    const startTime = Date.now();

    logger.info('Processing analytics job', {
      jobId: job.id,
      postId,
      platform,
    });

    try {
      // 1. Load social account credentials
      const account = await db.query.socialAccounts.findFirst({
        where: eq(socialAccounts.id, socialAccountId),
      });

      if (!account) {
        logger.warn('Social account not found, skipping analytics', {
          socialAccountId,
          postId,
        });
        return;
      }

      if (!account.isActive) {
        logger.warn('Social account is inactive, skipping analytics', {
          socialAccountId,
          postId,
        });
        return;
      }

      // 2. Get the platform connector
      const connector = platformService.getWrappedConnector(platform);

      if (connector.isCircuitOpen()) {
        logger.warn('Circuit breaker open for platform, will retry later', {
          platform,
          postId,
        });
        throw new Error(`Circuit breaker open for ${platform}`);
      }

      // 3. Decrypt access token
      const accessToken = decrypt(account.accessToken, encryptionKey);

      // 4. Fetch analytics from platform
      // Note: The current connector interface doesn't pass accessToken to getPostAnalytics
      // In a real implementation, you'd need to modify the interface or use a different approach
      const metrics = await connector.getPostAnalytics(platformPostId);

      // 5. Calculate engagement rate
      const totalEngagements = metrics.likes + metrics.comments + metrics.shares;
      const engagementRate =
        metrics.impressions > 0 ? (totalEngagements / metrics.impressions) * 100 : 0;

      // 6. Update post record with metrics
      await db
        .update(posts)
        .set({
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
          impressions: metrics.impressions,
          reach: metrics.reach,
          clicks: metrics.clicks,
          engagementRate,
          metricsUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(posts.id, postId));

      const duration = Date.now() - startTime;

      logger.info('Analytics job completed', {
        jobId: job.id,
        postId,
        platform,
        duration,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        impressions: metrics.impressions,
        engagementRate: engagementRate.toFixed(2),
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const classification = classifyError(error);

      logger.error('Analytics job failed', error, {
        jobId: job.id,
        postId,
        platform,
        duration,
        retryable: classification.retryable,
        category: classification.category,
      });

      // Re-throw for BullMQ retry handling
      throw error;
    }
  };
}
