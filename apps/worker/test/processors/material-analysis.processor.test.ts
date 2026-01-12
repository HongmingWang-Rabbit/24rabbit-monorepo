/**
 * Material Analysis Processor Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMaterialAnalysisProcessor } from '../../src/processors/material-analysis.processor';
import type { Job } from 'bullmq';
import type { AnalyzeJobData } from '@24rabbit/queue';

// Mock dependencies
const createMockDeps = () => ({
  db: {
    query: {
      materials: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
  materialService: {
    extractContent: vi.fn().mockResolvedValue({
      text: 'Extracted content text',
      metadata: { type: 'text' },
    }),
    analyzeContent: vi.fn().mockResolvedValue({
      summary: 'This is a summary',
      keyPoints: ['Point 1', 'Point 2'],
      keywords: ['keyword1', 'keyword2'],
      contentType: 'article',
      suggestedAngles: ['informative', 'engaging'],
      sentiment: 'positive',
    }),
  },
  similarityService: {
    storeEmbedding: vi.fn().mockResolvedValue('embedding-123'),
  },
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
});

const createMockJob = (data: Partial<AnalyzeJobData> = {}): Job<AnalyzeJobData> =>
  ({
    id: 'job-123',
    data: {
      materialId: 'material-123',
      organizationId: 'org-123',
      ...data,
    },
    updateProgress: vi.fn(),
  }) as unknown as Job<AnalyzeJobData>;

describe('MaterialAnalysisProcessor', () => {
  let mockDeps: ReturnType<typeof createMockDeps>;
  let processor: ReturnType<typeof createMaterialAnalysisProcessor>;

  beforeEach(() => {
    mockDeps = createMockDeps();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    processor = createMaterialAnalysisProcessor(mockDeps as any);
  });

  describe('successful processing', () => {
    it('should process material and update status to READY', async () => {
      const mockMaterial = {
        id: 'material-123',
        type: 'TEXT',
        status: 'PENDING',
        originalContent: 'Test content',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.materialService.extractContent).toHaveBeenCalled();
      expect(mockDeps.materialService.analyzeContent).toHaveBeenCalled();
      expect(mockDeps.similarityService.storeEmbedding).toHaveBeenCalled();
      expect(mockDeps.db.update).toHaveBeenCalled();
      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        'Material analysis completed',
        expect.any(Object)
      );
    });

    it('should update job progress throughout processing', async () => {
      const mockMaterial = {
        id: 'material-123',
        type: 'TEXT',
        status: 'PENDING',
        originalContent: 'Test content',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);

      const job = createMockJob();
      await processor(job);

      expect(job.updateProgress).toHaveBeenCalledWith(5);
      expect(job.updateProgress).toHaveBeenCalledWith(10);
      expect(job.updateProgress).toHaveBeenCalledWith(40);
      expect(job.updateProgress).toHaveBeenCalledWith(70);
      expect(job.updateProgress).toHaveBeenCalledWith(90);
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should store embedding with correct parameters', async () => {
      const mockMaterial = {
        id: 'material-123',
        type: 'TEXT',
        status: 'PENDING',
        originalContent: 'Test content',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.similarityService.storeEmbedding).toHaveBeenCalledWith(
        'material-123',
        'MATERIAL',
        expect.any(String),
        'org-123'
      );
    });
  });

  describe('skip conditions', () => {
    it('should skip if material is already READY', async () => {
      const mockMaterial = {
        id: 'material-123',
        type: 'TEXT',
        status: 'READY',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.materialService.extractContent).not.toHaveBeenCalled();
      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        'Material already processed, skipping',
        expect.any(Object)
      );
    });

    it('should skip if material is already USED', async () => {
      const mockMaterial = {
        id: 'material-123',
        type: 'TEXT',
        status: 'USED',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.materialService.extractContent).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw WorkerError if material not found', async () => {
      mockDeps.db.query.materials.findFirst.mockResolvedValue(null);

      const job = createMockJob();

      await expect(processor(job)).rejects.toThrow('Material not found');
    });

    it('should update material status to FAILED on error', async () => {
      const mockMaterial = {
        id: 'material-123',
        type: 'TEXT',
        status: 'PENDING',
        originalContent: 'Test content',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);
      mockDeps.materialService.extractContent.mockRejectedValue(new Error('Extraction failed'));

      const job = createMockJob();

      await expect(processor(job)).rejects.toThrow('Extraction failed');
      expect(mockDeps.logger.error).toHaveBeenCalled();
    });

    it('should log error details on failure', async () => {
      const mockMaterial = {
        id: 'material-123',
        type: 'TEXT',
        status: 'PENDING',
        originalContent: 'Test content',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);
      mockDeps.materialService.analyzeContent.mockRejectedValue(new Error('Analysis failed'));

      const job = createMockJob();

      await expect(processor(job)).rejects.toThrow();

      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        'Material analysis failed',
        expect.any(Error),
        expect.objectContaining({
          jobId: 'job-123',
          materialId: 'material-123',
        })
      );
    });
  });

  describe('different material types', () => {
    it('should process TEXT material', async () => {
      const mockMaterial = {
        id: 'material-123',
        type: 'TEXT',
        status: 'PENDING',
        originalContent: 'Test content',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.materialService.extractContent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'TEXT' })
      );
    });

    it('should process URL material', async () => {
      const mockMaterial = {
        id: 'material-123',
        type: 'URL',
        status: 'PENDING',
        url: 'https://example.com/article',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.materialService.extractContent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'URL' })
      );
    });

    it('should process IMAGE material', async () => {
      const mockMaterial = {
        id: 'material-123',
        type: 'IMAGE',
        status: 'PENDING',
        fileKey: 'images/photo.jpg',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.materialService.extractContent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'IMAGE' })
      );
    });
  });
});
