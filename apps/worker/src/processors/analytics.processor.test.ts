/**
 * Analytics Processor Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAnalyticsProcessor } from './analytics.processor';
import type { Job } from 'bullmq';
import type { AnalyticsJobData } from '@24rabbit/queue';

// Mock dependencies
const createMockDeps = () => ({
  db: {
    query: {
      socialAccounts: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
  platformService: {
    getWrappedConnector: vi.fn().mockReturnValue({
      isCircuitOpen: vi.fn().mockReturnValue(false),
      getPostAnalytics: vi.fn().mockResolvedValue({
        likes: 150,
        comments: 25,
        shares: 10,
        impressions: 5000,
        reach: 3500,
        clicks: 75,
      }),
    }),
  },
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  encryptionKey: '0123456789abcdef0123456789abcdef',
});

const createMockJob = (data: Partial<AnalyticsJobData> = {}): Job<AnalyticsJobData> =>
  ({
    id: 'job-123',
    data: {
      postId: 'post-123',
      platformPostId: 'fb-post-456',
      platform: 'FACEBOOK',
      socialAccountId: 'account-123',
      ...data,
    },
  }) as unknown as Job<AnalyticsJobData>;

describe('AnalyticsProcessor', () => {
  let mockDeps: ReturnType<typeof createMockDeps>;
  let processor: ReturnType<typeof createAnalyticsProcessor>;

  beforeEach(() => {
    mockDeps = createMockDeps();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    processor = createAnalyticsProcessor(mockDeps as any);

    vi.mock('@24rabbit/shared', () => ({
      decrypt: vi.fn().mockReturnValue('decrypted-token'),
    }));
  });

  describe('successful analytics collection', () => {
    it('should fetch and update post metrics', async () => {
      const mockAccount = {
        id: 'account-123',
        accessToken: 'encrypted-token',
        isActive: true,
      };

      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue(mockAccount);

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.platformService.getWrappedConnector).toHaveBeenCalledWith('FACEBOOK');
      expect(mockDeps.db.update).toHaveBeenCalled();
      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        'Analytics job completed',
        expect.objectContaining({
          postId: 'post-123',
          likes: 150,
          comments: 25,
          shares: 10,
        })
      );
    });

    it('should calculate engagement rate correctly', async () => {
      const mockAccount = {
        id: 'account-123',
        accessToken: 'token',
        isActive: true,
      };

      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue(mockAccount);

      const job = createMockJob();
      await processor(job);

      // Verify update was called with calculated engagement rate
      const updateCall = mockDeps.db.update.mock.results[0].value.set.mock.calls[0][0];

      // Total engagements = 150 + 25 + 10 = 185
      // Engagement rate = (185 / 5000) * 100 = 3.7%
      expect(updateCall.engagementRate).toBeCloseTo(3.7, 1);
    });

    it('should update all metric fields', async () => {
      const mockAccount = {
        id: 'account-123',
        accessToken: 'token',
        isActive: true,
      };

      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue(mockAccount);

      const job = createMockJob();
      await processor(job);

      const updateCall = mockDeps.db.update.mock.results[0].value.set.mock.calls[0][0];

      expect(updateCall).toMatchObject({
        likes: 150,
        comments: 25,
        shares: 10,
        impressions: 5000,
        reach: 3500,
        clicks: 75,
      });
    });

    it('should set metricsUpdatedAt timestamp', async () => {
      const mockAccount = {
        id: 'account-123',
        accessToken: 'token',
        isActive: true,
      };

      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue(mockAccount);

      const job = createMockJob();
      await processor(job);

      const updateCall = mockDeps.db.update.mock.results[0].value.set.mock.calls[0][0];

      expect(updateCall.metricsUpdatedAt).toBeInstanceOf(Date);
      expect(updateCall.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('skip conditions', () => {
    it('should skip if social account not found', async () => {
      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue(null);

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.platformService.getWrappedConnector).not.toHaveBeenCalled();
      expect(mockDeps.logger.warn).toHaveBeenCalledWith(
        'Social account not found, skipping analytics',
        expect.any(Object)
      );
    });

    it('should skip if social account is inactive', async () => {
      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue({
        id: 'account-123',
        isActive: false,
      });

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.platformService.getWrappedConnector).not.toHaveBeenCalled();
      expect(mockDeps.logger.warn).toHaveBeenCalledWith(
        'Social account is inactive, skipping analytics',
        expect.any(Object)
      );
    });
  });

  describe('circuit breaker', () => {
    it('should throw if circuit breaker is open', async () => {
      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue({
        id: 'account-123',
        accessToken: 'token',
        isActive: true,
      });
      mockDeps.platformService.getWrappedConnector.mockReturnValue({
        isCircuitOpen: vi.fn().mockReturnValue(true),
      });

      const job = createMockJob();

      await expect(processor(job)).rejects.toThrow('Circuit breaker open');
      expect(mockDeps.logger.warn).toHaveBeenCalledWith(
        'Circuit breaker open for platform, will retry later',
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should throw and log error on API failure', async () => {
      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue({
        id: 'account-123',
        accessToken: 'token',
        isActive: true,
      });
      mockDeps.platformService.getWrappedConnector.mockReturnValue({
        isCircuitOpen: vi.fn().mockReturnValue(false),
        getPostAnalytics: vi.fn().mockRejectedValue(new Error('API error')),
      });

      const job = createMockJob();

      await expect(processor(job)).rejects.toThrow('API error');
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        'Analytics job failed',
        expect.any(Error),
        expect.objectContaining({
          postId: 'post-123',
          platform: 'FACEBOOK',
        })
      );
    });
  });

  describe('zero impressions handling', () => {
    it('should set engagement rate to 0 when impressions are 0', async () => {
      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue({
        id: 'account-123',
        accessToken: 'token',
        isActive: true,
      });
      mockDeps.platformService.getWrappedConnector.mockReturnValue({
        isCircuitOpen: vi.fn().mockReturnValue(false),
        getPostAnalytics: vi.fn().mockResolvedValue({
          likes: 0,
          comments: 0,
          shares: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
        }),
      });

      const job = createMockJob();
      await processor(job);

      const updateCall = mockDeps.db.update.mock.results[0].value.set.mock.calls[0][0];

      expect(updateCall.engagementRate).toBe(0);
    });
  });
});
