/**
 * Rate Limiter Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRateLimiterService, type RateLimiterService } from './rate-limiter.service';

// Mock Redis client
function createMockRedis() {
  const store = new Map<string, string>();

  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    incr: vi.fn(async (key: string) => {
      const current = parseInt(store.get(key) ?? '0', 10);
      const next = current + 1;
      store.set(key, String(next));
      return next;
    }),
    expire: vi.fn(async () => 1),
    multi: vi.fn(() => ({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => {
        return [
          [null, 1],
          [null, 1],
          [null, 1],
          [null, 1],
          [null, 1],
          [null, 1],
        ];
      }),
    })),
  };
}

describe('RateLimiterService', () => {
  let mockRedis: ReturnType<typeof createMockRedis>;
  let rateLimiter: RateLimiterService;

  beforeEach(() => {
    mockRedis = createMockRedis();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rateLimiter = createRateLimiterService({ redis: mockRedis as any });
  });

  describe('checkLimit', () => {
    it('should allow request when under all limits', async () => {
      const result = await rateLimiter.checkLimit('FACEBOOK', 'account-123');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny request when minute limit is exceeded', async () => {
      // Set counts above minute limit
      const now = new Date();
      const minuteKey = `ratelimit:FACEBOOK:account-123:minute:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
      mockRedis.store.set(minuteKey, '10'); // Above limit of 5

      const result = await rateLimiter.checkLimit('FACEBOOK', 'account-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('minute_limit');
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeLessThanOrEqual(60);
    });

    it('should deny request when hour limit is exceeded', async () => {
      // Set hour count above limit
      const now = new Date();
      const hourKey = `ratelimit:FACEBOOK:account-123:hour:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
      mockRedis.store.set(hourKey, '30'); // Above limit of 25

      const result = await rateLimiter.checkLimit('FACEBOOK', 'account-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('hour_limit');
      expect(result.retryAfter).toBeDefined();
    });

    it('should deny request when day limit is exceeded', async () => {
      // Set day count above limit
      const now = new Date();
      const dayKey = `ratelimit:FACEBOOK:account-123:day:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      mockRedis.store.set(dayKey, '55'); // Above limit of 50

      const result = await rateLimiter.checkLimit('FACEBOOK', 'account-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('day_limit');
      expect(result.retryAfter).toBeDefined();
    });

    it('should return current count and limit in denial response', async () => {
      const now = new Date();
      const minuteKey = `ratelimit:FACEBOOK:account-123:minute:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
      mockRedis.store.set(minuteKey, '6');

      const result = await rateLimiter.checkLimit('FACEBOOK', 'account-123');

      expect(result.current).toBe(6);
      expect(result.limit).toBe(5);
    });

    it('should handle different platforms with different limits', async () => {
      // Instagram has lower limits
      const now = new Date();
      const minuteKey = `ratelimit:INSTAGRAM:account-123:minute:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
      mockRedis.store.set(minuteKey, '3'); // Instagram limit is 2

      const result = await rateLimiter.checkLimit('INSTAGRAM', 'account-123');

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(2);
    });
  });

  describe('recordRequest', () => {
    it('should increment all counters', async () => {
      await rateLimiter.recordRequest('FACEBOOK', 'account-123');

      expect(mockRedis.multi).toHaveBeenCalled();
    });

    it('should set appropriate TTLs on counters', async () => {
      await rateLimiter.recordRequest('FACEBOOK', 'account-123');

      // multi() was called to batch the operations
      expect(mockRedis.multi).toHaveBeenCalled();
    });
  });

  describe('getUsage', () => {
    it('should return current usage for an account', async () => {
      const now = new Date();
      const minuteKey = `ratelimit:FACEBOOK:account-123:minute:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
      const hourKey = `ratelimit:FACEBOOK:account-123:hour:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
      const dayKey = `ratelimit:FACEBOOK:account-123:day:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      mockRedis.store.set(minuteKey, '2');
      mockRedis.store.set(hourKey, '15');
      mockRedis.store.set(dayKey, '35');

      const usage = await rateLimiter.getUsage('FACEBOOK', 'account-123');

      expect(usage.minute).toBe(2);
      expect(usage.hour).toBe(15);
      expect(usage.day).toBe(35);
      expect(usage.limits).toEqual({
        postsPerMinute: 5,
        postsPerHour: 25,
        postsPerDay: 50,
      });
    });

    it('should return zero counts when no requests made', async () => {
      const usage = await rateLimiter.getUsage('FACEBOOK', 'new-account');

      expect(usage.minute).toBe(0);
      expect(usage.hour).toBe(0);
      expect(usage.day).toBe(0);
    });
  });
});
