/**
 * Publish Processor Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPublishProcessor } from './publish.processor';
import type { Job } from 'bullmq';
import type { PublishJobData } from '@24rabbit/queue';

// Mock dependencies
const createMockDeps = () => ({
  db: {
    query: {
      pendingPosts: {
        findFirst: vi.fn(),
      },
      socialAccounts: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'post-123' }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
  platformService: {
    getConnector: vi.fn().mockReturnValue({
      refreshToken: vi.fn().mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
      }),
    }),
    getWrappedConnector: vi.fn().mockReturnValue({
      isCircuitOpen: vi.fn().mockReturnValue(false),
      publishPost: vi.fn().mockResolvedValue({
        success: true,
        platformPostId: 'fb-post-123',
        publishedAt: new Date(),
      }),
    }),
  },
  rateLimiter: {
    checkLimit: vi.fn().mockResolvedValue({ allowed: true }),
    recordRequest: vi.fn().mockResolvedValue(undefined),
  },
  similarityService: {
    storeEmbedding: vi.fn().mockResolvedValue('embedding-123'),
  },
  analyticsQueue: {
    add: vi.fn().mockResolvedValue({}),
  },
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  encryptionKey: '0123456789abcdef0123456789abcdef',
});

const createMockJob = (data: Partial<PublishJobData> = {}): Job<PublishJobData> =>
  ({
    id: 'job-123',
    data: {
      pendingPostId: 'pending-123',
      brandProfileId: 'brand-123',
      socialAccountId: 'account-123',
      platform: 'FACEBOOK',
      organizationId: 'org-123',
      ...data,
    },
  }) as unknown as Job<PublishJobData>;

describe('PublishProcessor', () => {
  let mockDeps: ReturnType<typeof createMockDeps>;
  let processor: ReturnType<typeof createPublishProcessor>;

  beforeEach(() => {
    mockDeps = createMockDeps();
    processor = createPublishProcessor(mockDeps as any);

    // Mock decrypt function
    vi.mock('@24rabbit/shared', () => ({
      decrypt: vi.fn().mockReturnValue('decrypted-token'),
      encrypt: vi.fn().mockReturnValue('encrypted-token'),
    }));
  });

  describe('successful publishing', () => {
    it('should publish post and create post record', async () => {
      const mockPendingPost = {
        id: 'pending-123',
        content: 'Test post content',
        hashtags: ['test', 'post'],
        mediaUrls: null,
        status: 'APPROVED',
        materialId: 'material-123',
        scheduleId: null,
        angle: 'informative',
        angleReason: 'Test angle',
      };

      const mockAccount = {
        id: 'account-123',
        accessToken: 'encrypted-access-token',
        refreshToken: 'encrypted-refresh-token',
        tokenExpiresAt: new Date(Date.now() + 3600000),
        accountId: 'fb-page-123',
        isActive: true,
      };

      mockDeps.db.query.pendingPosts.findFirst.mockResolvedValue(mockPendingPost);
      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue(mockAccount);

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.platformService.getWrappedConnector).toHaveBeenCalledWith('FACEBOOK');
      expect(mockDeps.db.insert).toHaveBeenCalled();
      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        'Publish job completed',
        expect.any(Object)
      );
    });

    it('should record rate limit usage after successful publish', async () => {
      const mockPendingPost = {
        id: 'pending-123',
        content: 'Test post',
        status: 'APPROVED',
      };

      const mockAccount = {
        id: 'account-123',
        accessToken: 'token',
        tokenExpiresAt: new Date(Date.now() + 3600000),
        accountId: 'fb-page-123',
        isActive: true,
      };

      mockDeps.db.query.pendingPosts.findFirst.mockResolvedValue(mockPendingPost);
      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue(mockAccount);

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.rateLimiter.recordRequest).toHaveBeenCalledWith('FACEBOOK', 'fb-page-123');
    });

    it('should queue analytics job after successful publish', async () => {
      const mockPendingPost = {
        id: 'pending-123',
        content: 'Test post',
        status: 'APPROVED',
      };

      const mockAccount = {
        id: 'account-123',
        accessToken: 'token',
        tokenExpiresAt: new Date(Date.now() + 3600000),
        accountId: 'fb-page-123',
        isActive: true,
      };

      mockDeps.db.query.pendingPosts.findFirst.mockResolvedValue(mockPendingPost);
      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue(mockAccount);

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.analyticsQueue.add).toHaveBeenCalledWith(
        'collect-analytics',
        expect.objectContaining({
          postId: 'post-123',
          platformPostId: 'fb-post-123',
          platform: 'FACEBOOK',
        }),
        expect.objectContaining({
          delay: 5 * 60 * 1000,
        })
      );
    });
  });

  describe('skip conditions', () => {
    it('should skip if post is already published', async () => {
      const mockPendingPost = {
        id: 'pending-123',
        status: 'PUBLISHED',
      };

      mockDeps.db.query.pendingPosts.findFirst.mockResolvedValue(mockPendingPost);

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.platformService.getWrappedConnector).not.toHaveBeenCalled();
      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        'Post already published, skipping',
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should throw if pending post not found', async () => {
      mockDeps.db.query.pendingPosts.findFirst.mockResolvedValue(null);

      const job = createMockJob();

      await expect(processor(job)).rejects.toThrow('Pending post not found');
    });

    it('should throw if social account not found', async () => {
      mockDeps.db.query.pendingPosts.findFirst.mockResolvedValue({
        id: 'pending-123',
        status: 'APPROVED',
      });
      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue(null);

      const job = createMockJob();

      await expect(processor(job)).rejects.toThrow('Social account not found');
    });

    it('should throw if social account is inactive', async () => {
      mockDeps.db.query.pendingPosts.findFirst.mockResolvedValue({
        id: 'pending-123',
        status: 'APPROVED',
      });
      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue({
        id: 'account-123',
        isActive: false,
      });

      const job = createMockJob();

      await expect(processor(job)).rejects.toThrow('Social account is inactive');
    });
  });

  describe('rate limiting', () => {
    it('should throw RateLimitError when rate limit exceeded', async () => {
      mockDeps.db.query.pendingPosts.findFirst.mockResolvedValue({
        id: 'pending-123',
        status: 'APPROVED',
      });
      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue({
        id: 'account-123',
        accessToken: 'token',
        accountId: 'fb-page-123',
        isActive: true,
      });
      mockDeps.rateLimiter.checkLimit.mockResolvedValue({
        allowed: false,
        reason: 'hour_limit',
        retryAfter: 1800,
      });

      const job = createMockJob();

      await expect(processor(job)).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('circuit breaker', () => {
    it('should throw if circuit breaker is open', async () => {
      mockDeps.db.query.pendingPosts.findFirst.mockResolvedValue({
        id: 'pending-123',
        status: 'APPROVED',
      });
      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue({
        id: 'account-123',
        accessToken: 'token',
        accountId: 'fb-page-123',
        isActive: true,
      });
      mockDeps.platformService.getWrappedConnector.mockReturnValue({
        isCircuitOpen: vi.fn().mockReturnValue(true),
      });

      const job = createMockJob();

      await expect(processor(job)).rejects.toThrow('Circuit breaker open');
    });
  });

  describe('token refresh', () => {
    it('should refresh token when expired', async () => {
      mockDeps.db.query.pendingPosts.findFirst.mockResolvedValue({
        id: 'pending-123',
        content: 'Test',
        status: 'APPROVED',
      });
      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue({
        id: 'account-123',
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        tokenExpiresAt: new Date(Date.now() - 1000), // Expired
        accountId: 'fb-page-123',
        isActive: true,
      });

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.platformService.getConnector).toHaveBeenCalledWith('FACEBOOK');
      // Token refresh should have been called
    });

    it('should throw AuthError when refresh fails and no refresh token', async () => {
      mockDeps.db.query.pendingPosts.findFirst.mockResolvedValue({
        id: 'pending-123',
        status: 'APPROVED',
      });
      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue({
        id: 'account-123',
        accessToken: 'old-token',
        refreshToken: null, // No refresh token
        tokenExpiresAt: new Date(Date.now() - 1000), // Expired
        accountId: 'fb-page-123',
        isActive: true,
      });

      const job = createMockJob();

      await expect(processor(job)).rejects.toThrow('no refresh token');
    });
  });

  describe('publish failure handling', () => {
    it('should throw when platform returns failure', async () => {
      mockDeps.db.query.pendingPosts.findFirst.mockResolvedValue({
        id: 'pending-123',
        content: 'Test',
        status: 'APPROVED',
      });
      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue({
        id: 'account-123',
        accessToken: 'token',
        tokenExpiresAt: new Date(Date.now() + 3600000),
        accountId: 'fb-page-123',
        isActive: true,
      });
      mockDeps.platformService.getWrappedConnector.mockReturnValue({
        isCircuitOpen: vi.fn().mockReturnValue(false),
        publishPost: vi.fn().mockResolvedValue({
          success: false,
          error: 'Content policy violation',
        }),
      });

      const job = createMockJob();

      await expect(processor(job)).rejects.toThrow('Content policy violation');
    });

    it('should update pending post status to FAILED on permanent failure', async () => {
      mockDeps.db.query.pendingPosts.findFirst.mockResolvedValue({
        id: 'pending-123',
        status: 'APPROVED',
      });
      mockDeps.db.query.socialAccounts.findFirst.mockResolvedValue(null);

      const job = createMockJob();

      await expect(processor(job)).rejects.toThrow();

      // Should attempt to update status to FAILED
      expect(mockDeps.db.update).toHaveBeenCalled();
    });
  });
});
