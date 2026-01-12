/**
 * Material Analysis Processor
 *
 * Extracts content from uploaded materials, analyzes them using AI,
 * and generates embeddings for similarity matching.
 */

import type { Job } from 'bullmq';
import type { AnalyzeJobData } from '@24rabbit/queue';
import type { Database } from '@24rabbit/database';
import { eq } from '@24rabbit/database';
import { materials } from '@24rabbit/database';
import type { MaterialService } from '../services/material.service';
import type { SimilarityService } from '../services/similarity.service';
import type { Logger } from '../utils/logger';
import { classifyError, WorkerError } from '../utils/errors';

// =============================================================================
// Types
// =============================================================================

export interface MaterialAnalysisProcessorDeps {
  db: Database;
  materialService: MaterialService;
  similarityService: SimilarityService;
  logger: Logger;
}

// =============================================================================
// Processor Factory
// =============================================================================

/**
 * Create the material analysis processor function
 */
export function createMaterialAnalysisProcessor(deps: MaterialAnalysisProcessorDeps) {
  const { db, materialService, similarityService, logger } = deps;

  return async (job: Job<AnalyzeJobData>): Promise<void> => {
    const { materialId, organizationId } = job.data;
    const startTime = Date.now();

    logger.info('Processing material analysis job', {
      jobId: job.id,
      materialId,
      organizationId,
    });

    try {
      // 1. Load material record
      await job.updateProgress(5);
      const material = await db.query.materials.findFirst({
        where: eq(materials.id, materialId),
      });

      if (!material) {
        throw new WorkerError(
          `Material not found: ${materialId}`,
          false, // not retryable
          'not_found'
        );
      }

      // Check if already processed
      if (material.status === 'READY' || material.status === 'USED') {
        logger.info('Material already processed, skipping', { materialId });
        return;
      }

      // 2. Update status to PROCESSING
      await db
        .update(materials)
        .set({ status: 'PROCESSING', updatedAt: new Date() })
        .where(eq(materials.id, materialId));

      await job.updateProgress(10);

      // 3. Extract content from material
      logger.debug('Extracting content', { materialId, type: material.type });

      const extractedContent = await materialService.extractContent({
        id: material.id,
        type: material.type as 'TEXT' | 'URL' | 'FILE' | 'IMAGE' | 'VIDEO',
        originalContent: material.originalContent,
        fileKey: material.fileKey,
        mimeType: material.mimeType,
        url: material.url,
      });

      await job.updateProgress(40);

      // 4. Analyze content with AI
      logger.debug('Analyzing content', { materialId });

      const analysis = await materialService.analyzeContent(extractedContent, material.type);

      await job.updateProgress(70);

      // 5. Generate and store embedding
      logger.debug('Generating embedding', { materialId });

      const textForEmbedding = [
        analysis.summary,
        analysis.keyPoints.join(' '),
        analysis.keywords.join(' '),
      ].join(' ');

      const embeddingId = await similarityService.storeEmbedding(
        materialId,
        'MATERIAL',
        textForEmbedding,
        organizationId
      );

      await job.updateProgress(90);

      // 6. Update material with analysis results
      await db
        .update(materials)
        .set({
          status: 'READY',
          summary: analysis.summary,
          keyPoints: analysis.keyPoints,
          keywords: analysis.keywords,
          suggestedAngles: analysis.suggestedAngles as any, // Type cast for enum array
          sentiment: analysis.sentiment,
          contentPillar: analysis.contentType,
          embeddingId,
          updatedAt: new Date(),
        })
        .where(eq(materials.id, materialId));

      await job.updateProgress(100);

      const duration = Date.now() - startTime;

      logger.info('Material analysis completed', {
        jobId: job.id,
        materialId,
        type: material.type,
        duration,
        keyPointsCount: analysis.keyPoints.length,
        keywordsCount: analysis.keywords.length,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const classification = classifyError(error);

      logger.error('Material analysis failed', error, {
        jobId: job.id,
        materialId,
        duration,
        retryable: classification.retryable,
        category: classification.category,
      });

      // Update material status to FAILED
      try {
        await db
          .update(materials)
          .set({
            status: 'FAILED',
            updatedAt: new Date(),
          })
          .where(eq(materials.id, materialId));
      } catch (updateError) {
        logger.error('Failed to update material status', updateError);
      }

      // Re-throw for BullMQ retry handling
      throw error;
    }
  };
}
