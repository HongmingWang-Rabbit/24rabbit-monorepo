/**
 * Content Scheduler Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createContentScheduler, type ContentScheduler } from './content-scheduler';

// Mock dependencies
const createMockDeps = () => ({
  db: {
    query: {
      schedules: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      materials: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
  generateQueue: {
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

describe('ContentScheduler', () => {
  let mockDeps: ReturnType<typeof createMockDeps>;
  let scheduler: ContentScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    mockDeps = createMockDeps();
    scheduler = createContentScheduler(mockDeps as any);
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  describe('tick', () => {
    it('should acquire lock before processing', async () => {
      await scheduler.tick();

      expect(mockDeps.lock.acquire).toHaveBeenCalledWith('content-scheduler', expect.any(Number));
    });

    it('should release lock after processing', async () => {
      await scheduler.tick();

      expect(mockDeps.lock.release).toHaveBeenCalledWith('content-scheduler');
    });

    it('should skip if lock cannot be acquired', async () => {
      mockDeps.lock.acquire.mockResolvedValue(false);

      await scheduler.tick();

      expect(mockDeps.db.query.schedules.findMany).not.toHaveBeenCalled();
      expect(mockDeps.logger.debug).toHaveBeenCalledWith(
        'Content scheduler lock not acquired, skipping tick'
      );
    });

    it('should query for due schedules', async () => {
      await scheduler.tick();

      expect(mockDeps.db.query.schedules.findMany).toHaveBeenCalled();
    });

    it('should log when no schedules are due', async () => {
      mockDeps.db.query.schedules.findMany.mockResolvedValue([]);

      await scheduler.tick();

      expect(mockDeps.logger.debug).toHaveBeenCalledWith('No schedules due for content generation');
    });

    it('should queue generation jobs for due schedules', async () => {
      const mockSchedules = [
        {
          id: 'schedule-123',
          organizationId: 'org-123',
          brandProfileId: 'brand-123',
          materialSelectionStrategy: 'ROUND_ROBIN',
          frequency: 'DAILY',
          platforms: ['FACEBOOK'],
          brandProfile: {
            socialAccounts: [{ platform: 'FACEBOOK' }],
          },
        },
      ];

      const mockMaterials = [
        { id: 'material-123', usageCount: 0, lastUsedAt: null, createdAt: new Date() },
      ];

      mockDeps.db.query.schedules.findMany.mockResolvedValue(mockSchedules);
      mockDeps.db.query.materials.findMany.mockResolvedValue(mockMaterials);

      await scheduler.tick();

      expect(mockDeps.generateQueue.add).toHaveBeenCalledWith(
        'generate-content',
        expect.objectContaining({
          scheduleId: 'schedule-123',
          materialId: 'material-123',
          brandProfileId: 'brand-123',
          organizationId: 'org-123',
        }),
        expect.any(Object)
      );
    });

    it('should update nextRunAt after queuing job', async () => {
      const mockSchedules = [
        {
          id: 'schedule-123',
          organizationId: 'org-123',
          brandProfileId: 'brand-123',
          materialSelectionStrategy: 'RANDOM',
          frequency: 'HOURLY',
          frequencyValue: 1,
          brandProfile: {
            socialAccounts: [{ platform: 'FACEBOOK' }],
          },
        },
      ];

      const mockMaterials = [{ id: 'material-123', usageCount: 0, createdAt: new Date() }];

      mockDeps.db.query.schedules.findMany.mockResolvedValue(mockSchedules);
      mockDeps.db.query.materials.findMany.mockResolvedValue(mockMaterials);

      await scheduler.tick();

      expect(mockDeps.db.update).toHaveBeenCalled();
    });

    it('should skip schedule if no materials available', async () => {
      const mockSchedules = [
        {
          id: 'schedule-123',
          organizationId: 'org-123',
          brandProfileId: 'brand-123',
          materialSelectionStrategy: 'ROUND_ROBIN',
          brandProfile: {
            socialAccounts: [],
          },
        },
      ];

      mockDeps.db.query.schedules.findMany.mockResolvedValue(mockSchedules);
      mockDeps.db.query.materials.findMany.mockResolvedValue([]);

      await scheduler.tick();

      expect(mockDeps.generateQueue.add).not.toHaveBeenCalled();
      expect(mockDeps.logger.warn).toHaveBeenCalledWith(
        'No available materials for schedule',
        expect.any(Object)
      );
    });

    it('should skip schedule if no platforms configured', async () => {
      const mockSchedules = [
        {
          id: 'schedule-123',
          organizationId: 'org-123',
          brandProfileId: 'brand-123',
          materialSelectionStrategy: 'ROUND_ROBIN',
          platforms: null,
          brandProfile: {
            socialAccounts: [],
          },
        },
      ];

      const mockMaterials = [{ id: 'material-123' }];

      mockDeps.db.query.schedules.findMany.mockResolvedValue(mockSchedules);
      mockDeps.db.query.materials.findMany.mockResolvedValue(mockMaterials);

      await scheduler.tick();

      expect(mockDeps.generateQueue.add).not.toHaveBeenCalled();
      expect(mockDeps.logger.warn).toHaveBeenCalledWith(
        'No platforms configured for schedule',
        expect.any(Object)
      );
    });

    it('should handle errors for individual schedules without stopping', async () => {
      const mockSchedules = [
        {
          id: 'schedule-1',
          organizationId: 'org-123',
          brandProfileId: 'brand-123',
          materialSelectionStrategy: 'ROUND_ROBIN',
          frequency: 'DAILY',
          brandProfile: { socialAccounts: [{ platform: 'FACEBOOK' }] },
        },
        {
          id: 'schedule-2',
          organizationId: 'org-123',
          brandProfileId: 'brand-123',
          materialSelectionStrategy: 'ROUND_ROBIN',
          frequency: 'DAILY',
          brandProfile: { socialAccounts: [{ platform: 'FACEBOOK' }] },
        },
      ];

      const mockMaterials = [{ id: 'material-123', usageCount: 0, createdAt: new Date() }];

      mockDeps.db.query.schedules.findMany.mockResolvedValue(mockSchedules);
      mockDeps.db.query.materials.findMany.mockResolvedValue(mockMaterials);
      mockDeps.generateQueue.add
        .mockRejectedValueOnce(new Error('Queue error'))
        .mockResolvedValueOnce({ id: 'job-2' });

      await scheduler.tick();

      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        'Failed to process schedule',
        expect.any(Error),
        expect.objectContaining({ scheduleId: 'schedule-1' })
      );
      // Second schedule should still be processed
      expect(mockDeps.generateQueue.add).toHaveBeenCalledTimes(2);
    });
  });

  describe('start', () => {
    it('should run tick immediately on start', async () => {
      scheduler.start();

      // Tick should be called
      await vi.advanceTimersByTimeAsync(0);

      expect(mockDeps.lock.acquire).toHaveBeenCalled();
    });

    it('should run tick on interval', async () => {
      scheduler.start(60000); // 1 minute interval

      await vi.advanceTimersByTimeAsync(0); // Initial tick
      expect(mockDeps.lock.acquire).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(60000); // After 1 minute
      expect(mockDeps.lock.acquire).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(60000); // After 2 minutes
      expect(mockDeps.lock.acquire).toHaveBeenCalledTimes(3);
    });

    it('should warn if already running', () => {
      scheduler.start();
      scheduler.start();

      expect(mockDeps.logger.warn).toHaveBeenCalledWith('Content scheduler already running');
    });

    it('should log start with interval', () => {
      scheduler.start(300000); // 5 minutes

      expect(mockDeps.logger.info).toHaveBeenCalledWith('Content scheduler started', {
        intervalMs: 300000,
      });
    });
  });

  describe('stop', () => {
    it('should stop the scheduler', () => {
      scheduler.start();
      scheduler.stop();

      expect(mockDeps.logger.info).toHaveBeenCalledWith('Content scheduler stopped');
    });

    it('should prevent further ticks after stop', async () => {
      scheduler.start(60000);

      await vi.advanceTimersByTimeAsync(0); // Initial tick
      expect(mockDeps.lock.acquire).toHaveBeenCalledTimes(1);

      scheduler.stop();

      await vi.advanceTimersByTimeAsync(60000);
      expect(mockDeps.lock.acquire).toHaveBeenCalledTimes(1); // No additional calls
    });
  });

  describe('material selection strategies', () => {
    it('should select least recently used material for ROUND_ROBIN', async () => {
      const mockSchedules = [
        {
          id: 'schedule-123',
          organizationId: 'org-123',
          brandProfileId: 'brand-123',
          materialSelectionStrategy: 'ROUND_ROBIN',
          frequency: 'DAILY',
          brandProfile: { socialAccounts: [{ platform: 'FACEBOOK' }] },
        },
      ];

      const mockMaterials = [
        {
          id: 'material-1',
          usageCount: 5,
          lastUsedAt: new Date('2024-01-02'),
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'material-2',
          usageCount: 3,
          lastUsedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
        },
        { id: 'material-3', usageCount: 0, lastUsedAt: null, createdAt: new Date('2024-01-01') },
      ];

      mockDeps.db.query.schedules.findMany.mockResolvedValue(mockSchedules);
      mockDeps.db.query.materials.findMany.mockResolvedValue(mockMaterials);

      await scheduler.tick();

      expect(mockDeps.generateQueue.add).toHaveBeenCalledWith(
        'generate-content',
        expect.objectContaining({
          materialId: 'material-3', // Never used
        }),
        expect.any(Object)
      );
    });

    it('should select highest priority material for PRIORITY', async () => {
      const mockSchedules = [
        {
          id: 'schedule-123',
          organizationId: 'org-123',
          brandProfileId: 'brand-123',
          materialSelectionStrategy: 'PRIORITY',
          frequency: 'DAILY',
          brandProfile: { socialAccounts: [{ platform: 'FACEBOOK' }] },
        },
      ];

      const mockMaterials = [
        { id: 'material-1', priority: 1, createdAt: new Date() },
        { id: 'material-2', priority: 10, createdAt: new Date() },
        { id: 'material-3', priority: 5, createdAt: new Date() },
      ];

      mockDeps.db.query.schedules.findMany.mockResolvedValue(mockSchedules);
      mockDeps.db.query.materials.findMany.mockResolvedValue(mockMaterials);

      await scheduler.tick();

      expect(mockDeps.generateQueue.add).toHaveBeenCalledWith(
        'generate-content',
        expect.objectContaining({
          materialId: 'material-2', // Highest priority
        }),
        expect.any(Object)
      );
    });

    it('should select least used material for LEAST_USED', async () => {
      const mockSchedules = [
        {
          id: 'schedule-123',
          organizationId: 'org-123',
          brandProfileId: 'brand-123',
          materialSelectionStrategy: 'LEAST_USED',
          frequency: 'DAILY',
          brandProfile: { socialAccounts: [{ platform: 'FACEBOOK' }] },
        },
      ];

      const mockMaterials = [
        { id: 'material-1', usageCount: 10 },
        { id: 'material-2', usageCount: 2 },
        { id: 'material-3', usageCount: 5 },
      ];

      mockDeps.db.query.schedules.findMany.mockResolvedValue(mockSchedules);
      mockDeps.db.query.materials.findMany.mockResolvedValue(mockMaterials);

      await scheduler.tick();

      expect(mockDeps.generateQueue.add).toHaveBeenCalledWith(
        'generate-content',
        expect.objectContaining({
          materialId: 'material-2', // Least used
        }),
        expect.any(Object)
      );
    });
  });
});
