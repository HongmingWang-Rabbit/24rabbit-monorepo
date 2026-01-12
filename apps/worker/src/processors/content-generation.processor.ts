/**
 * Content Generation Processor
 *
 * Generates platform-specific content variations using AI,
 * applying Brand Profile context and checking for content similarity.
 */

import type { Job } from 'bullmq';
import type { GenerateJobData } from '@24rabbit/queue';
import type { Database } from '@24rabbit/database';
import type { AIAdapter, ContentGenerationOptions } from '@24rabbit/ai';
import { eq } from '@24rabbit/database';
import { brandProfiles, materials, pendingPosts, schedules } from '@24rabbit/database';
import type { SocialPlatform } from '@24rabbit/shared';
import { PLATFORM_LIMITS } from '@24rabbit/shared';
import type { SimilarityService } from '../services/similarity.service';
import type { Logger } from '../utils/logger';
import { classifyError, WorkerError } from '../utils/errors';
import { config } from '../config';

// =============================================================================
// Types
// =============================================================================

export interface ContentGenerationProcessorDeps {
  db: Database;
  aiAdapter: AIAdapter;
  similarityService: SimilarityService;
  logger: Logger;
}

interface BrandProfileContext {
  id: string;
  name: string;
  brandVoice: string | null;
  toneKeywords: string[];
  languageRules: string[];
  examplePosts: string[];
  hashtagRules: {
    required: string[];
    preferred: string[];
    forbidden: string[];
  } | null;
  emojiUsage: 'NONE' | 'MINIMAL' | 'MODERATE' | 'HEAVY';
  targetAudience: string | null;
  contentPillars: string[];
  postingGuidelines: string | null;
}

interface GeneratedVariation {
  content: string;
  hashtags: string[];
  angle: string;
  angleReason: string;
  platform: SocialPlatform;
}

// =============================================================================
// Processor Factory
// =============================================================================

/**
 * Create the content generation processor function
 */
export function createContentGenerationProcessor(deps: ContentGenerationProcessorDeps) {
  const { db, aiAdapter, similarityService, logger } = deps;

  return async (job: Job<GenerateJobData>): Promise<void> => {
    const {
      materialId,
      brandProfileId,
      organizationId,
      platforms,
      scheduleId,
      scheduledFor,
      isManual = false,
    } = job.data;
    const startTime = Date.now();

    logger.info('Processing content generation job', {
      jobId: job.id,
      materialId,
      brandProfileId,
      platforms,
      isManual,
    });

    try {
      await job.updateProgress(5);

      // 1. Load material
      const material = await db.query.materials.findFirst({
        where: eq(materials.id, materialId),
      });

      if (!material) {
        throw new WorkerError(`Material not found: ${materialId}`, false, 'not_found');
      }

      if (material.status !== 'READY') {
        throw new WorkerError(
          `Material not ready for content generation: ${material.status}`,
          true, // Retry - material might still be processing
          'validation'
        );
      }

      await job.updateProgress(10);

      // 2. Load Brand Profile with full context
      const brandProfile = await loadBrandProfileContext(db, brandProfileId);

      if (!brandProfile) {
        throw new WorkerError(`Brand profile not found: ${brandProfileId}`, false, 'not_found');
      }

      await job.updateProgress(15);

      // 3. Pre-generation similarity check (avoid generating duplicate content)
      const materialText = [
        material.summary,
        material.keyPoints?.join(' '),
        material.originalContent,
      ]
        .filter(Boolean)
        .join(' ');

      const similarContent = await similarityService.checkSimilarity(
        materialText.slice(0, 2000),
        organizationId,
        config.similarityThreshold - 0.1 // Slightly lower threshold for pre-check
      );

      if (similarContent.length > 0) {
        logger.warn('Similar content already exists, proceeding with caution', {
          materialId,
          similarCount: similarContent.length,
          topSimilarity: similarContent[0]?.similarity,
        });
      }

      await job.updateProgress(25);

      // 4. Generate content for each platform
      const allVariations: GeneratedVariation[] = [];

      for (const platform of platforms) {
        const platformProgress = 25 + ((platforms.indexOf(platform) + 1) / platforms.length) * 50;

        logger.debug('Generating content for platform', { materialId, platform });

        const variations = await generatePlatformContent(
          aiAdapter,
          material,
          brandProfile,
          platform
        );

        // 5. Validate each variation
        const validVariations = await validateAndFilterVariations(
          variations,
          platform,
          brandProfile,
          similarityService,
          organizationId,
          logger
        );

        if (validVariations.length === 0) {
          logger.warn('No valid variations generated for platform', {
            materialId,
            platform,
            originalCount: variations.length,
          });
          continue;
        }

        allVariations.push(...validVariations);
        await job.updateProgress(platformProgress);
      }

      if (allVariations.length === 0) {
        throw new WorkerError(
          'Failed to generate any valid content variations',
          true,
          'generation_failed'
        );
      }

      await job.updateProgress(80);

      // 6. Create pending posts for each variation
      const pendingPostIds: string[] = [];

      for (const variation of allVariations) {
        const [pendingPost] = await db
          .insert(pendingPosts)
          .values({
            organizationId,
            brandProfileId,
            materialId,
            scheduleId: scheduleId ?? null,
            content: variation.content,
            hashtags: variation.hashtags,
            platform: variation.platform,
            status: isManual ? 'PENDING_APPROVAL' : 'APPROVED', // Auto-approve scheduled content
            angle: variation.angle,
            angleReason: variation.angleReason,
            scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
            generatedAt: new Date(),
          })
          .returning();

        pendingPostIds.push(pendingPost.id);
      }

      await job.updateProgress(90);

      // 7. Update schedule's lastGeneratedAt if this was a scheduled job
      if (scheduleId) {
        await db
          .update(schedules)
          .set({
            lastGeneratedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schedules.id, scheduleId));
      }

      await job.updateProgress(100);

      const duration = Date.now() - startTime;

      logger.info('Content generation completed', {
        jobId: job.id,
        materialId,
        brandProfileId,
        variationsGenerated: allVariations.length,
        pendingPostIds,
        platforms,
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const classification = classifyError(error);

      logger.error('Content generation failed', error, {
        jobId: job.id,
        materialId,
        brandProfileId,
        duration,
        retryable: classification.retryable,
        category: classification.category,
      });

      // Re-throw for BullMQ retry handling
      throw error;
    }
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Load Brand Profile with all context needed for content generation
 */
async function loadBrandProfileContext(
  db: Database,
  brandProfileId: string
): Promise<BrandProfileContext | null> {
  const profile = await db.query.brandProfiles.findFirst({
    where: eq(brandProfiles.id, brandProfileId),
  });

  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    name: profile.name,
    brandVoice: profile.brandVoice,
    toneKeywords: (profile.toneKeywords as string[]) ?? [],
    languageRules: (profile.languageRules as string[]) ?? [],
    examplePosts: (profile.examplePosts as string[]) ?? [],
    hashtagRules: profile.hashtagRules as BrandProfileContext['hashtagRules'],
    emojiUsage: (profile.emojiUsage as BrandProfileContext['emojiUsage']) ?? 'MINIMAL',
    targetAudience: profile.targetAudience,
    contentPillars: (profile.contentPillars as string[]) ?? [],
    postingGuidelines: profile.postingGuidelines,
  };
}

/**
 * Generate content variations for a specific platform
 */
async function generatePlatformContent(
  aiAdapter: AIAdapter,
  material: {
    summary: string | null;
    keyPoints: string[] | null;
    keywords: string[] | null;
    suggestedAngles: string[] | null;
    originalContent: string | null;
  },
  brandProfile: BrandProfileContext,
  platform: SocialPlatform
): Promise<GeneratedVariation[]> {
  const platformLimits = PLATFORM_LIMITS[platform];
  const angles = material.suggestedAngles ?? ['informative', 'engaging', 'promotional'];

  const variations: GeneratedVariation[] = [];

  // Generate variations using different angles
  for (let i = 0; i < Math.min(config.contentGeneration.variationsCount, angles.length); i++) {
    const angle = angles[i] ?? 'engaging';

    const options: ContentGenerationOptions = {
      material: {
        summary: material.summary ?? '',
        keyPoints: material.keyPoints ?? [],
        keywords: material.keywords ?? [],
      },
      brandVoice: brandProfile.brandVoice ?? undefined,
      toneKeywords: brandProfile.toneKeywords,
      targetAudience: brandProfile.targetAudience ?? undefined,
      platform,
      maxLength: platformLimits.maxLength,
      includeHashtags: true,
      hashtagCount: Math.min(5, platformLimits.maxHashtags ?? 30),
      emojiUsage: brandProfile.emojiUsage.toLowerCase() as
        | 'none'
        | 'minimal'
        | 'moderate'
        | 'heavy',
      languageRules: brandProfile.languageRules,
      examplePosts: brandProfile.examplePosts.slice(0, 3), // Limit examples to avoid token bloat
      angle,
    };

    const result = await aiAdapter.generateCopy(options);

    variations.push({
      content: result.content,
      hashtags: result.hashtags ?? [],
      angle,
      angleReason: result.reasoning ?? `Generated with ${angle} approach`,
      platform,
    });
  }

  return variations;
}

/**
 * Validate variations against platform limits, brand rules, and similarity
 */
async function validateAndFilterVariations(
  variations: GeneratedVariation[],
  platform: SocialPlatform,
  brandProfile: BrandProfileContext,
  similarityService: SimilarityService,
  organizationId: string,
  logger: Logger
): Promise<GeneratedVariation[]> {
  const platformLimits = PLATFORM_LIMITS[platform];
  const validVariations: GeneratedVariation[] = [];

  for (const variation of variations) {
    // Check platform character limit
    if (variation.content.length > platformLimits.maxLength) {
      logger.debug('Variation exceeds platform limit, truncating', {
        platform,
        length: variation.content.length,
        limit: platformLimits.maxLength,
      });
      // Truncate to limit (could be smarter about this)
      variation.content = variation.content.slice(0, platformLimits.maxLength - 3) + '...';
    }

    // Check for forbidden hashtags
    if (brandProfile.hashtagRules?.forbidden) {
      const hasForbidden = variation.hashtags.some((tag) =>
        brandProfile.hashtagRules!.forbidden.some(
          (forbidden) => tag.toLowerCase() === forbidden.toLowerCase()
        )
      );
      if (hasForbidden) {
        logger.debug('Variation contains forbidden hashtag, filtering', {
          hashtags: variation.hashtags,
        });
        // Remove forbidden hashtags instead of rejecting
        variation.hashtags = variation.hashtags.filter(
          (tag) =>
            !brandProfile.hashtagRules!.forbidden.some(
              (forbidden) => tag.toLowerCase() === forbidden.toLowerCase()
            )
        );
      }
    }

    // Add required hashtags if missing
    if (brandProfile.hashtagRules?.required) {
      for (const required of brandProfile.hashtagRules.required) {
        if (!variation.hashtags.some((tag) => tag.toLowerCase() === required.toLowerCase())) {
          variation.hashtags.push(required);
        }
      }
    }

    // Post-generation similarity check
    try {
      const similar = await similarityService.checkSimilarity(
        variation.content,
        organizationId,
        config.similarityThreshold
      );

      if (similar.length > 0) {
        logger.debug('Variation too similar to existing content, skipping', {
          similarity: similar[0]?.similarity,
          existingId: similar[0]?.id,
        });
        continue;
      }
    } catch {
      // Non-critical - log and continue
      logger.warn('Similarity check failed, continuing without check');
    }

    validVariations.push(variation);
  }

  return validVariations;
}
