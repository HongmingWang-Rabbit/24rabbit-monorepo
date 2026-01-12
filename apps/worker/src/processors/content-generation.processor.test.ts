/**
 * Content Generation Processor Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createContentGenerationProcessor } from './content-generation.processor';
import type { Job } from 'bullmq';
import type { GenerateJobData } from '@24rabbit/queue';

// Mock dependencies
const createMockDeps = () => ({
  db: {
    query: {
      materials: {
        findFirst: vi.fn(),
      },
      brandProfiles: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'pending-post-123' }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
  aiAdapter: {
    generateCopy: vi.fn().mockResolvedValue({
      content: 'Generated post content #hashtag',
      hashtags: ['hashtag', 'social'],
      estimatedEngagement: 'high',
      reasoning: 'Engaging hook with clear CTA',
    }),
  },
  similarityService: {
    checkSimilarity: vi.fn().mockResolvedValue([]),
  },
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
});

const createMockJob = (data: Partial<GenerateJobData> = {}): Job<GenerateJobData> =>
  ({
    id: 'job-123',
    data: {
      materialId: 'material-123',
      brandProfileId: 'brand-123',
      organizationId: 'org-123',
      platforms: ['FACEBOOK'],
      isManual: false,
      ...data,
    },
    updateProgress: vi.fn(),
  }) as unknown as Job<GenerateJobData>;

describe('ContentGenerationProcessor', () => {
  let mockDeps: ReturnType<typeof createMockDeps>;
  let processor: ReturnType<typeof createContentGenerationProcessor>;

  beforeEach(() => {
    mockDeps = createMockDeps();
    processor = createContentGenerationProcessor(mockDeps as any);
  });

  describe('successful generation', () => {
    it('should generate content and create pending posts', async () => {
      const mockMaterial = {
        id: 'material-123',
        status: 'READY',
        summary: 'Article about technology',
        keyPoints: ['AI is growing', 'New trends'],
        keywords: ['tech', 'AI'],
        suggestedAngles: ['informative', 'engaging'],
        originalContent: 'Full article content...',
      };

      const mockBrandProfile = {
        id: 'brand-123',
        name: 'Tech Brand',
        brandVoice: 'Professional and innovative',
        toneKeywords: ['innovative', 'trustworthy'],
        languageRules: ['Avoid jargon'],
        examplePosts: ['Example post 1'],
        hashtagRules: { required: [], preferred: ['tech'], forbidden: ['spam'] },
        emojiUsage: 'MINIMAL',
        targetAudience: 'Tech professionals',
        contentPillars: ['technology', 'innovation'],
        postingGuidelines: 'Be concise',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);
      mockDeps.db.query.brandProfiles.findFirst.mockResolvedValue(mockBrandProfile);

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.aiAdapter.generateCopy).toHaveBeenCalled();
      expect(mockDeps.db.insert).toHaveBeenCalled();
      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        'Content generation completed',
        expect.objectContaining({
          materialId: 'material-123',
          brandProfileId: 'brand-123',
        })
      );
    });

    it('should generate content for multiple platforms', async () => {
      const mockMaterial = {
        id: 'material-123',
        status: 'READY',
        summary: 'Summary',
        keyPoints: ['Point 1'],
        keywords: ['keyword'],
        suggestedAngles: ['informative'],
      };

      const mockBrandProfile = {
        id: 'brand-123',
        name: 'Brand',
        brandVoice: 'Professional',
        emojiUsage: 'MINIMAL',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);
      mockDeps.db.query.brandProfiles.findFirst.mockResolvedValue(mockBrandProfile);

      const job = createMockJob({ platforms: ['FACEBOOK', 'TWITTER', 'LINKEDIN'] });
      await processor(job);

      // Should call generateCopy for each platform (3 variations each)
      expect(mockDeps.aiAdapter.generateCopy).toHaveBeenCalled();
    });

    it('should update job progress throughout processing', async () => {
      const mockMaterial = {
        id: 'material-123',
        status: 'READY',
        summary: 'Summary',
        keyPoints: [],
        keywords: [],
        suggestedAngles: ['informative'],
      };

      const mockBrandProfile = {
        id: 'brand-123',
        name: 'Brand',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);
      mockDeps.db.query.brandProfiles.findFirst.mockResolvedValue(mockBrandProfile);

      const job = createMockJob();
      await processor(job);

      expect(job.updateProgress).toHaveBeenCalledWith(5);
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should create APPROVED pending posts for scheduled jobs', async () => {
      const mockMaterial = {
        id: 'material-123',
        status: 'READY',
        summary: 'Summary',
        keyPoints: [],
        keywords: [],
        suggestedAngles: ['engaging'],
      };

      const mockBrandProfile = {
        id: 'brand-123',
        name: 'Brand',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);
      mockDeps.db.query.brandProfiles.findFirst.mockResolvedValue(mockBrandProfile);

      const job = createMockJob({ isManual: false });
      await processor(job);

      const insertCall = mockDeps.db.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(insertCall.status).toBe('APPROVED');
    });

    it('should create PENDING_APPROVAL pending posts for manual jobs', async () => {
      const mockMaterial = {
        id: 'material-123',
        status: 'READY',
        summary: 'Summary',
        keyPoints: [],
        keywords: [],
        suggestedAngles: ['engaging'],
      };

      const mockBrandProfile = {
        id: 'brand-123',
        name: 'Brand',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);
      mockDeps.db.query.brandProfiles.findFirst.mockResolvedValue(mockBrandProfile);

      const job = createMockJob({ isManual: true });
      await processor(job);

      const insertCall = mockDeps.db.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(insertCall.status).toBe('PENDING_APPROVAL');
    });
  });

  describe('error handling', () => {
    it('should throw if material not found', async () => {
      mockDeps.db.query.materials.findFirst.mockResolvedValue(null);

      const job = createMockJob();

      await expect(processor(job)).rejects.toThrow('Material not found');
    });

    it('should throw if material is not ready', async () => {
      mockDeps.db.query.materials.findFirst.mockResolvedValue({
        id: 'material-123',
        status: 'PROCESSING',
      });

      const job = createMockJob();

      await expect(processor(job)).rejects.toThrow('Material not ready');
    });

    it('should throw if brand profile not found', async () => {
      mockDeps.db.query.materials.findFirst.mockResolvedValue({
        id: 'material-123',
        status: 'READY',
      });
      mockDeps.db.query.brandProfiles.findFirst.mockResolvedValue(null);

      const job = createMockJob();

      await expect(processor(job)).rejects.toThrow('Brand profile not found');
    });
  });

  describe('similarity checking', () => {
    it('should warn when similar content exists pre-generation', async () => {
      const mockMaterial = {
        id: 'material-123',
        status: 'READY',
        summary: 'Summary',
        keyPoints: [],
        keywords: [],
        suggestedAngles: ['engaging'],
      };

      const mockBrandProfile = {
        id: 'brand-123',
        name: 'Brand',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);
      mockDeps.db.query.brandProfiles.findFirst.mockResolvedValue(mockBrandProfile);
      // Pre-generation check returns similar content
      // Post-generation checks return empty (variation is OK)
      mockDeps.similarityService.checkSimilarity
        .mockResolvedValueOnce([{ id: 'existing-123', contentType: 'POST', similarity: 0.8 }]) // Pre-gen check - similar exists
        .mockResolvedValue([]); // Post-gen checks - variations are OK

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.logger.warn).toHaveBeenCalledWith(
        'Similar content already exists, proceeding with caution',
        expect.any(Object)
      );
    });

    it('should skip variations that are too similar to existing content', async () => {
      const mockMaterial = {
        id: 'material-123',
        status: 'READY',
        summary: 'Summary',
        keyPoints: [],
        keywords: [],
        suggestedAngles: ['engaging', 'informative', 'promotional'],
      };

      const mockBrandProfile = {
        id: 'brand-123',
        name: 'Brand',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);
      mockDeps.db.query.brandProfiles.findFirst.mockResolvedValue(mockBrandProfile);

      // First check returns nothing (pre-generation)
      // Post-generation checks return similar content
      mockDeps.similarityService.checkSimilarity
        .mockResolvedValueOnce([]) // Pre-generation check
        .mockResolvedValueOnce([{ id: 'existing', similarity: 0.9 }]) // Variation 1 - too similar
        .mockResolvedValueOnce([]) // Variation 2 - OK
        .mockResolvedValueOnce([{ id: 'existing', similarity: 0.9 }]); // Variation 3 - too similar

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.logger.debug).toHaveBeenCalledWith(
        'Variation too similar to existing content, skipping',
        expect.any(Object)
      );
    });
  });

  describe('brand profile context', () => {
    it('should pass brand voice to AI adapter', async () => {
      const mockMaterial = {
        id: 'material-123',
        status: 'READY',
        summary: 'Summary',
        keyPoints: ['Key point'],
        keywords: ['keyword'],
        suggestedAngles: ['informative'],
      };

      const mockBrandProfile = {
        id: 'brand-123',
        name: 'Brand',
        brandVoice: 'Friendly and casual',
        toneKeywords: ['fun', 'approachable'],
        languageRules: ['Use simple language'],
        examplePosts: ['Example 1', 'Example 2'],
        emojiUsage: 'MODERATE',
        targetAudience: 'Young professionals',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);
      mockDeps.db.query.brandProfiles.findFirst.mockResolvedValue(mockBrandProfile);

      const job = createMockJob();
      await processor(job);

      expect(mockDeps.aiAdapter.generateCopy).toHaveBeenCalledWith(
        expect.objectContaining({
          brandVoice: 'Friendly and casual',
          toneKeywords: ['fun', 'approachable'],
          targetAudience: 'Young professionals',
          emojiUsage: 'moderate',
        })
      );
    });

    it('should add required hashtags from brand profile', async () => {
      const mockMaterial = {
        id: 'material-123',
        status: 'READY',
        summary: 'Summary',
        keyPoints: [],
        keywords: [],
        suggestedAngles: ['engaging'],
      };

      const mockBrandProfile = {
        id: 'brand-123',
        name: 'Brand',
        hashtagRules: {
          required: ['brandhash', 'required'],
          preferred: [],
          forbidden: [],
        },
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);
      mockDeps.db.query.brandProfiles.findFirst.mockResolvedValue(mockBrandProfile);
      mockDeps.aiAdapter.generateCopy.mockResolvedValue({
        content: 'Generated content',
        hashtags: ['generated'],
        reasoning: 'Test',
      });

      const job = createMockJob();
      await processor(job);

      const insertCall = mockDeps.db.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(insertCall.hashtags).toContain('brandhash');
      expect(insertCall.hashtags).toContain('required');
    });

    it('should remove forbidden hashtags from brand profile', async () => {
      const mockMaterial = {
        id: 'material-123',
        status: 'READY',
        summary: 'Summary',
        keyPoints: [],
        keywords: [],
        suggestedAngles: ['engaging'],
      };

      const mockBrandProfile = {
        id: 'brand-123',
        name: 'Brand',
        hashtagRules: {
          required: [],
          preferred: [],
          forbidden: ['spam', 'forbidden'],
        },
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);
      mockDeps.db.query.brandProfiles.findFirst.mockResolvedValue(mockBrandProfile);
      mockDeps.aiAdapter.generateCopy.mockResolvedValue({
        content: 'Generated content',
        hashtags: ['good', 'spam', 'ok'],
        reasoning: 'Test',
      });

      const job = createMockJob();
      await processor(job);

      const insertCall = mockDeps.db.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(insertCall.hashtags).not.toContain('spam');
      expect(insertCall.hashtags).toContain('good');
      expect(insertCall.hashtags).toContain('ok');
    });
  });

  describe('schedule handling', () => {
    it('should update schedule lastGeneratedAt when scheduleId provided', async () => {
      const mockMaterial = {
        id: 'material-123',
        status: 'READY',
        summary: 'Summary',
        keyPoints: [],
        keywords: [],
        suggestedAngles: ['engaging'],
      };

      const mockBrandProfile = {
        id: 'brand-123',
        name: 'Brand',
      };

      mockDeps.db.query.materials.findFirst.mockResolvedValue(mockMaterial);
      mockDeps.db.query.brandProfiles.findFirst.mockResolvedValue(mockBrandProfile);

      const job = createMockJob({ scheduleId: 'schedule-123' });
      await processor(job);

      expect(mockDeps.db.update).toHaveBeenCalled();
    });
  });
});
