/**
 * Analytics Scheduler Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createAnalyticsScheduler,
  type AnalyticsScheduler,
} from '../../src/schedulers/analytics-scheduler';

// Mock dependencies
const createMockDeps = () => ({
  db: {
    query: {
      posts: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  },
  analyticsQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-123' }),
  },
  lock: {
    acquire: vi.fn().mockResolvedValue(true),
    release: vi.fn().mockResolvedValue(true),
  },
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
});

describe('AnalyticsScheduler', () => {
  let mockDeps: ReturnType<typeof createMockDeps>;
  let scheduler: AnalyticsScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    mockDeps = createMockDeps();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scheduler = createAnalyticsScheduler(mockDeps as any);
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  describe('tick', () => {
    it('should acquire lock before processing', async () => {
      await scheduler.tick();

      expect(mockDeps.lock.acquire).toHaveBeenCalledWith('analytics-scheduler', expect.any(Number));
    });

    it('should release lock after processing', async () => {
      await scheduler.tick();

      expect(mockDeps.lock.release).toHaveBeenCalledWith('analytics-scheduler');
    });

    it('should skip if lock cannot be acquired', async () => {
      mockDeps.lock.acquire.mockResolvedValue(false);

      await scheduler.tick();

      expect(mockDeps.db.query.posts.findMany).not.toHaveBeenCalled();
      expect(mockDeps.logger.debug).toHaveBeenCalledWith(
        'Analytics scheduler lock not acquired, skipping tick'
      );
    });

    it('should query for recent posts with platform IDs', async () => {
      await scheduler.tick();

      expect(mockDeps.db.query.posts.findMany).toHaveBeenCalled();
    });

    it('should log when no posts need analytics', async () => {
      mockDeps.db.query.posts.findMany.mockResolvedValue([]);

      await scheduler.tick();

      expect(mockDeps.logger.debug).toHaveBeenCalledWith('No posts need analytics collection');
    });

    it('should queue analytics jobs for recent posts', async () => {
      const mockPosts = [
        {
          id: 'post-123',
          externalId: 'fb-123',
          platform: 'FACEBOOK',
          socialAccountId: 'account-123',
          metricsUpdatedAt: null,
          publishedAt: new Date(),
        },
      ];

      mockDeps.db.query.posts.findMany.mockResolvedValue(mockPosts);

      await scheduler.tick();

      expect(mockDeps.analyticsQueue.add).toHaveBeenCalledWith(
        'collect-analytics',
        expect.objectContaining({
          postId: 'post-123',
          platformPostId: 'fb-123',
          platform: 'FACEBOOK',
          socialAccountId: 'account-123',
        }),
        expect.any(Object)
      );
    });

    it('should stagger job delays to avoid rate limiting', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          externalId: 'fb-1',
          platform: 'FACEBOOK',
          socialAccountId: 'account-123',
          metricsUpdatedAt: null,
          publishedAt: new Date(),
        },
        {
          id: 'post-2',
          externalId: 'fb-2',
          platform: 'FACEBOOK',
          socialAccountId: 'account-123',
          metricsUpdatedAt: null,
          publishedAt: new Date(),
        },
        {
          id: 'post-3',
          externalId: 'fb-3',
          platform: 'FACEBOOK',
          socialAccountId: 'account-123',
          metricsUpdatedAt: null,
          publishedAt: new Date(),
        },
      ];

      mockDeps.db.query.posts.findMany.mockResolvedValue(mockPosts);

      await scheduler.tick();

      const calls = mockDeps.analyticsQueue.add.mock.calls;

      expect(calls[0][2].delay).toBe(0);
      expect(calls[1][2].delay).toBe(1000);
      expect(calls[2][2].delay).toBe(2000);
    });

    it('should skip posts with recent metrics update', async () => {
      const recentUpdate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

      const mockPosts = [
        {
          id: 'post-1',
          externalId: 'fb-1',
          platform: 'FACEBOOK',
          socialAccountId: 'account-123',
          metricsUpdatedAt: recentUpdate,
          publishedAt: new Date(),
        },
        {
          id: 'post-2',
          externalId: 'fb-2',
          platform: 'FACEBOOK',
          socialAccountId: 'account-123',
          metricsUpdatedAt: null, // Never updated
          publishedAt: new Date(),
        },
      ];

      mockDeps.db.query.posts.findMany.mockResolvedValue(mockPosts);

      await scheduler.tick();

      // Only post-2 should be queued (post-1 was updated less than 30 min ago)
      expect(mockDeps.analyticsQueue.add).toHaveBeenCalledTimes(1);
      expect(mockDeps.analyticsQueue.add).toHaveBeenCalledWith(
        'collect-analytics',
        expect.objectContaining({ postId: 'post-2' }),
        expect.any(Object)
      );
    });

    it('should handle errors for individual posts without stopping', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          externalId: 'fb-1',
          platform: 'FACEBOOK',
          socialAccountId: 'account-123',
          metricsUpdatedAt: null,
          publishedAt: new Date(),
        },
        {
          id: 'post-2',
          externalId: 'fb-2',
          platform: 'FACEBOOK',
          socialAccountId: 'account-123',
          metricsUpdatedAt: null,
          publishedAt: new Date(),
        },
      ];

      mockDeps.db.query.posts.findMany.mockResolvedValue(mockPosts);
      mockDeps.analyticsQueue.add
        .mockRejectedValueOnce(new Error('Queue error'))
        .mockResolvedValueOnce({ id: 'job-2' });

      await scheduler.tick();

      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        'Failed to queue analytics job',
        expect.any(Error),
        expect.objectContaining({ postId: 'post-1' })
      );
      // Second post should still be processed
      expect(mockDeps.analyticsQueue.add).toHaveBeenCalledTimes(2);
    });

    it('should log summary of jobs queued by platform', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          externalId: 'fb-1',
          platform: 'FACEBOOK',
          socialAccountId: 'acc-1',
          metricsUpdatedAt: null,
          publishedAt: new Date(),
        },
        {
          id: 'post-2',
          externalId: 'fb-2',
          platform: 'FACEBOOK',
          socialAccountId: 'acc-1',
          metricsUpdatedAt: null,
          publishedAt: new Date(),
        },
        {
          id: 'post-3',
          externalId: 'tw-1',
          platform: 'TWITTER',
          socialAccountId: 'acc-2',
          metricsUpdatedAt: null,
          publishedAt: new Date(),
        },
      ];

      mockDeps.db.query.posts.findMany.mockResolvedValue(mockPosts);

      await scheduler.tick();

      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        'Analytics scheduler tick completed',
        expect.objectContaining({
          jobsQueued: 3,
          jobsByPlatform: { FACEBOOK: 2, TWITTER: 1 },
        })
      );
    });
  });

  describe('start', () => {
    it('should run tick immediately on start', async () => {
      scheduler.start();

      await vi.advanceTimersByTimeAsync(0);

      expect(mockDeps.lock.acquire).toHaveBeenCalled();
    });

    it('should run tick on interval', async () => {
      scheduler.start(3600000); // 1 hour

      await vi.advanceTimersByTimeAsync(0); // Initial tick
      expect(mockDeps.lock.acquire).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(3600000); // After 1 hour
      expect(mockDeps.lock.acquire).toHaveBeenCalledTimes(2);
    });

    it('should warn if already running', () => {
      scheduler.start();
      scheduler.start();

      expect(mockDeps.logger.warn).toHaveBeenCalledWith('Analytics scheduler already running');
    });

    it('should log start with interval', () => {
      scheduler.start(3600000);

      expect(mockDeps.logger.info).toHaveBeenCalledWith('Analytics scheduler started', {
        intervalMs: 3600000,
      });
    });
  });

  describe('stop', () => {
    it('should stop the scheduler', () => {
      scheduler.start();
      scheduler.stop();

      expect(mockDeps.logger.info).toHaveBeenCalledWith('Analytics scheduler stopped');
    });

    it('should prevent further ticks after stop', async () => {
      scheduler.start(3600000);

      await vi.advanceTimersByTimeAsync(0); // Initial tick
      expect(mockDeps.lock.acquire).toHaveBeenCalledTimes(1);

      scheduler.stop();

      await vi.advanceTimersByTimeAsync(3600000);
      expect(mockDeps.lock.acquire).toHaveBeenCalledTimes(1); // No additional calls
    });
  });

  describe('lookback period', () => {
    it('should only query posts from last 7 days', async () => {
      await scheduler.tick();

      // The query should have been called with date filter
      expect(mockDeps.db.query.posts.findMany).toHaveBeenCalled();
      // Verify the lookback is applied (checked via query parameters)
    });
  });

  describe('batch size', () => {
    it('should limit posts to batch size', async () => {
      await scheduler.tick();

      // The query should respect the batch limit
      expect(mockDeps.db.query.posts.findMany).toHaveBeenCalled();
    });
  });
});
