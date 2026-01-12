/**
 * Rate Limiter Service
 *
 * Redis-based rate limiting for social platform API calls.
 * Tracks limits per social account (not just per platform).
 */

import type { SocialPlatform } from '@24rabbit/shared';
import type { RateLimitResult, RateLimitConfig } from '../types';
import { config } from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('rate-limiter');

// Use 'any' type for Redis to avoid ioredis version mismatch issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisLike = any;

// =============================================================================
// Platform Rate Limit Configurations
// =============================================================================

const PLATFORM_RATE_LIMITS: Record<SocialPlatform, RateLimitConfig> = {
  FACEBOOK: { postsPerDay: 50, postsPerHour: 25, postsPerMinute: 5 },
  TWITTER: { postsPerDay: 50, postsPerHour: 25, postsPerMinute: 5 },
  LINKEDIN: { postsPerDay: 100, postsPerHour: 50, postsPerMinute: 10 },
  INSTAGRAM: { postsPerDay: 25, postsPerHour: 10, postsPerMinute: 2 },
  YOUTUBE: { postsPerDay: 10, postsPerHour: 5, postsPerMinute: 1 },
  REDDIT: { postsPerDay: 10, postsPerHour: 5, postsPerMinute: 1 },
  TIKTOK: { postsPerDay: 50, postsPerHour: 20, postsPerMinute: 3 },
};

// =============================================================================
// Redis Key Helpers
// =============================================================================

function getDateKey(date: Date, format: 'day' | 'hour' | 'minute'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  switch (format) {
    case 'day':
      return `${year}-${month}-${day}`;
    case 'hour':
      return `${year}-${month}-${day}-${hour}`;
    case 'minute':
      return `${year}-${month}-${day}-${hour}-${minute}`;
  }
}

interface RateLimitKeys {
  day: string;
  hour: string;
  minute: string;
}

function getRateLimitKeys(
  platform: SocialPlatform,
  accountId: string,
  now: Date = new Date()
): RateLimitKeys {
  const prefix = `ratelimit:${platform}:${accountId}`;
  return {
    day: `${prefix}:day:${getDateKey(now, 'day')}`,
    hour: `${prefix}:hour:${getDateKey(now, 'hour')}`,
    minute: `${prefix}:minute:${getDateKey(now, 'minute')}`,
  };
}

// TTLs for rate limit keys (in seconds)
const RATE_LIMIT_TTLS = {
  day: 86400 + 3600, // 25 hours (buffer for timezone edge cases)
  hour: 3600 + 60, // 61 minutes
  minute: 60 + 10, // 70 seconds
};

// =============================================================================
// Rate Limiter Service
// =============================================================================

export interface RateLimiterService {
  /**
   * Check if a request is allowed under rate limits
   */
  checkLimit(platform: SocialPlatform, accountId: string): Promise<RateLimitResult>;

  /**
   * Record a successful request (increment counters)
   */
  recordRequest(platform: SocialPlatform, accountId: string): Promise<void>;

  /**
   * Get current usage for an account
   */
  getUsage(
    platform: SocialPlatform,
    accountId: string
  ): Promise<{
    minute: number;
    hour: number;
    day: number;
    limits: RateLimitConfig;
  }>;
}

export interface RateLimiterServiceDeps {
  redis: RedisLike;
}

/**
 * Create a rate limiter service
 */
export function createRateLimiterService(deps: RateLimiterServiceDeps): RateLimiterService {
  const { redis } = deps;
  return {
    async checkLimit(platform: SocialPlatform, accountId: string): Promise<RateLimitResult> {
      const keys = getRateLimitKeys(platform, accountId);
      const limits = PLATFORM_RATE_LIMITS[platform] ?? {
        postsPerDay: config.rateLimit.defaultPostsPerDay,
        postsPerHour: config.rateLimit.defaultPostsPerHour,
        postsPerMinute: 5,
      };

      // Get current counts
      const [minuteCount, hourCount, dayCount] = await Promise.all([
        redis.get(keys.minute),
        redis.get(keys.hour),
        redis.get(keys.day),
      ]);

      const counts = {
        minute: parseInt(minuteCount ?? '0', 10),
        hour: parseInt(hourCount ?? '0', 10),
        day: parseInt(dayCount ?? '0', 10),
      };

      // Check minute limit
      if (counts.minute >= limits.postsPerMinute) {
        const now = new Date();
        const retryAfter = 60 - now.getSeconds();
        logger.warn('Rate limit exceeded (minute)', {
          platform,
          accountId,
          current: counts.minute,
          limit: limits.postsPerMinute,
        });
        return {
          allowed: false,
          reason: 'minute_limit',
          retryAfter,
          current: counts.minute,
          limit: limits.postsPerMinute,
        };
      }

      // Check hour limit
      if (counts.hour >= limits.postsPerHour) {
        const now = new Date();
        const retryAfter = 3600 - now.getMinutes() * 60 - now.getSeconds();
        logger.warn('Rate limit exceeded (hour)', {
          platform,
          accountId,
          current: counts.hour,
          limit: limits.postsPerHour,
        });
        return {
          allowed: false,
          reason: 'hour_limit',
          retryAfter,
          current: counts.hour,
          limit: limits.postsPerHour,
        };
      }

      // Check day limit
      if (counts.day >= limits.postsPerDay) {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const retryAfter = Math.floor((midnight.getTime() - now.getTime()) / 1000);
        logger.warn('Rate limit exceeded (day)', {
          platform,
          accountId,
          current: counts.day,
          limit: limits.postsPerDay,
        });
        return {
          allowed: false,
          reason: 'day_limit',
          retryAfter,
          current: counts.day,
          limit: limits.postsPerDay,
        };
      }

      return { allowed: true };
    },

    async recordRequest(platform: SocialPlatform, accountId: string): Promise<void> {
      const keys = getRateLimitKeys(platform, accountId);

      // Increment all counters atomically with appropriate TTLs
      const pipeline = redis.multi();
      pipeline.incr(keys.minute);
      pipeline.expire(keys.minute, RATE_LIMIT_TTLS.minute);
      pipeline.incr(keys.hour);
      pipeline.expire(keys.hour, RATE_LIMIT_TTLS.hour);
      pipeline.incr(keys.day);
      pipeline.expire(keys.day, RATE_LIMIT_TTLS.day);
      await pipeline.exec();

      logger.debug('Rate limit counter incremented', { platform, accountId });
    },

    async getUsage(platform: SocialPlatform, accountId: string) {
      const keys = getRateLimitKeys(platform, accountId);
      const limits = PLATFORM_RATE_LIMITS[platform] ?? {
        postsPerDay: config.rateLimit.defaultPostsPerDay,
        postsPerHour: config.rateLimit.defaultPostsPerHour,
        postsPerMinute: 5,
      };

      const [minuteCount, hourCount, dayCount] = await Promise.all([
        redis.get(keys.minute),
        redis.get(keys.hour),
        redis.get(keys.day),
      ]);

      return {
        minute: parseInt(minuteCount ?? '0', 10),
        hour: parseInt(hourCount ?? '0', 10),
        day: parseInt(dayCount ?? '0', 10),
        limits,
      };
    },
  };
}
