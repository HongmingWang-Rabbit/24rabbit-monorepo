/**
 * Publish Processor
 *
 * Publishes approved content to social platforms.
 * Handles rate limiting, token refresh, and error recovery.
 */

import type { Job } from 'bullmq';
import type { PublishJobData, analyticsQueue } from '@24rabbit/queue';
import type { Database } from '@24rabbit/database';
import { eq } from '@24rabbit/database';
import { pendingPosts, posts, socialAccounts, materials } from '@24rabbit/database';
import { decrypt, encrypt } from '@24rabbit/shared';
import type { Queue } from 'bullmq';
import type { AnalyticsJobData } from '@24rabbit/queue';
import type { PlatformService } from '../services/platform.service';
import type { RateLimiterService } from '../services/rate-limiter.service';
import type { SimilarityService } from '../services/similarity.service';
import type { Logger } from '../utils/logger';
import { classifyError, RateLimitError, AuthError, WorkerError } from '../utils/errors';
import { config } from '../config';

// =============================================================================
// Types
// =============================================================================

export interface PublishProcessorDeps {
  db: Database;
  platformService: PlatformService;
  rateLimiter: RateLimiterService;
  similarityService: SimilarityService;
  analyticsQueue: Queue<AnalyticsJobData>;
  logger: Logger;
  encryptionKey: string;
}

// =============================================================================
// Processor Factory
// =============================================================================

/**
 * Create the publish processor function
 */
export function createPublishProcessor(deps: PublishProcessorDeps) {
  const {
    db,
    platformService,
    rateLimiter,
    similarityService,
    analyticsQueue,
    logger,
    encryptionKey,
  } = deps;

  return async (job: Job<PublishJobData>): Promise<void> => {
    const { pendingPostId, brandProfileId, socialAccountId, platform, organizationId } = job.data;
    const startTime = Date.now();

    logger.info('Processing publish job', {
      jobId: job.id,
      pendingPostId,
      platform,
    });

    try {
      // 1. Load pending post
      const pendingPost = await db.query.pendingPosts.findFirst({
        where: eq(pendingPosts.id, pendingPostId),
      });

      if (!pendingPost) {
        throw new WorkerError(`Pending post not found: ${pendingPostId}`, false, 'not_found');
      }

      // Check if already published
      if (pendingPost.status === 'PUBLISHED') {
        logger.info('Post already published, skipping', { pendingPostId });
        return;
      }

      // 2. Load social account
      const account = await db.query.socialAccounts.findFirst({
        where: eq(socialAccounts.id, socialAccountId),
      });

      if (!account) {
        throw new WorkerError(`Social account not found: ${socialAccountId}`, false, 'not_found');
      }

      if (!account.isActive) {
        throw new WorkerError('Social account is inactive', false, 'auth');
      }

      // 3. Check rate limits
      const rateLimitResult = await rateLimiter.checkLimit(platform, account.accountId);

      if (!rateLimitResult.allowed) {
        const retryAfterMs = (rateLimitResult.retryAfter ?? 60) * 1000;
        throw new RateLimitError(`Rate limit exceeded: ${rateLimitResult.reason}`, retryAfterMs);
      }

      // 4. Check and refresh token if needed
      let accessToken = decrypt(account.accessToken, encryptionKey);

      if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
        logger.info('Token expired, attempting refresh', { socialAccountId });

        if (!account.refreshToken) {
          throw new AuthError('Token expired and no refresh token available', true);
        }

        try {
          const connector = platformService.getConnector(platform);
          const newTokens = await connector.refreshToken(
            decrypt(account.refreshToken, encryptionKey)
          );

          // Update stored tokens
          await db
            .update(socialAccounts)
            .set({
              accessToken: encrypt(newTokens.accessToken, encryptionKey),
              refreshToken: newTokens.refreshToken
                ? encrypt(newTokens.refreshToken, encryptionKey)
                : account.refreshToken,
              tokenExpiresAt: newTokens.expiresAt,
              updatedAt: new Date(),
            })
            .where(eq(socialAccounts.id, socialAccountId));

          accessToken = newTokens.accessToken;
          logger.info('Token refreshed successfully', { socialAccountId });
        } catch (refreshError) {
          logger.error('Token refresh failed', refreshError, { socialAccountId });
          throw new AuthError('Token refresh failed, account needs reconnection', true);
        }
      }

      // 5. Publish to platform
      const connector = platformService.getWrappedConnector(platform);

      if (connector.isCircuitOpen()) {
        throw new WorkerError(`Circuit breaker open for ${platform}`, true, 'service_unavailable');
      }

      const publishResult = await connector.publishPost({
        content: pendingPost.content,
        mediaUrls: pendingPost.mediaUrls ?? undefined,
        accessToken,
        pageId: account.accountId, // For Facebook, accountId is the page ID
      });

      if (!publishResult.success) {
        throw new WorkerError(publishResult.error ?? 'Publishing failed', true, 'unknown');
      }

      // 6. Record rate limit usage
      await rateLimiter.recordRequest(platform, account.accountId);

      // 7. Create post record
      const [newPost] = await db
        .insert(posts)
        .values({
          organizationId,
          brandProfileId,
          socialAccountId,
          materialId: pendingPost.materialId,
          scheduleId: pendingPost.scheduleId,
          pendingPostId,
          content: pendingPost.content,
          hashtags: pendingPost.hashtags,
          mediaUrls: pendingPost.mediaUrls,
          platform,
          externalId: publishResult.platformPostId,
          publishedAt: publishResult.publishedAt ?? new Date(),
          angle: pendingPost.angle,
          angleReason: pendingPost.angleReason,
        })
        .returning();

      // 8. Update pending post status
      await db
        .update(pendingPosts)
        .set({
          status: 'PUBLISHED',
          updatedAt: new Date(),
        })
        .where(eq(pendingPosts.id, pendingPostId));

      // 9. Update material usage count
      if (pendingPost.materialId) {
        await db
          .update(materials)
          .set({
            usageCount: (materials.usageCount as unknown as number) + 1,
            lastUsedAt: new Date(),
            status: 'USED',
            updatedAt: new Date(),
          })
          .where(eq(materials.id, pendingPost.materialId));
      }

      // 10. Store post embedding for future similarity checks
      if (pendingPost.content) {
        try {
          await similarityService.storeEmbedding(
            newPost.id,
            'POST',
            pendingPost.content,
            organizationId
          );
        } catch (embeddingError) {
          // Non-critical, log and continue
          logger.warn('Failed to store post embedding', { postId: newPost.id });
        }
      }

      // 11. Queue analytics job for initial metrics fetch (after 5 minutes)
      if (publishResult.platformPostId) {
        await analyticsQueue.add(
          'collect-analytics',
          {
            postId: newPost.id,
            platformPostId: publishResult.platformPostId,
            platform,
            socialAccountId,
          },
          {
            delay: config.analytics.postPublishDelayMs,
          }
        );
      }

      const duration = Date.now() - startTime;

      logger.info('Publish job completed', {
        jobId: job.id,
        pendingPostId,
        postId: newPost.id,
        platform,
        platformPostId: publishResult.platformPostId,
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const classification = classifyError(error);

      logger.error('Publish job failed', error, {
        jobId: job.id,
        pendingPostId,
        platform,
        duration,
        retryable: classification.retryable,
        category: classification.category,
      });

      // Handle rate limit errors specially - reschedule with delay
      if (error instanceof RateLimitError) {
        // The error will be thrown and BullMQ will handle retry
        // But we could also manually reschedule here if needed
      }

      // Update pending post status on permanent failure
      if (!classification.retryable) {
        try {
          await db
            .update(pendingPosts)
            .set({
              status: 'FAILED',
              updatedAt: new Date(),
            })
            .where(eq(pendingPosts.id, pendingPostId));
        } catch (updateError) {
          logger.error('Failed to update pending post status', updateError);
        }
      }

      // Re-throw for BullMQ retry handling
      throw error;
    }
  };
}
