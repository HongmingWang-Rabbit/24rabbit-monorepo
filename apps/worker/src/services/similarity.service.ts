/**
 * Similarity Service
 *
 * Handles content deduplication using pgvector embeddings.
 * Checks if new content is too similar to recently published posts.
 */

import type { AIAdapter } from '@24rabbit/ai';
import type { Database } from '@24rabbit/database';
import { sql } from '@24rabbit/database';
import type { SimilarContent } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('similarity-service');

// =============================================================================
// Similarity Service Interface
// =============================================================================

export interface SimilarityService {
  /**
   * Check if content is too similar to recent posts
   * Returns an array of similar content above the threshold
   */
  checkSimilarity(
    text: string,
    organizationId: string,
    threshold?: number
  ): Promise<SimilarContent[]>;

  /**
   * Store embedding for a piece of content
   */
  storeEmbedding(
    contentId: string,
    contentType: 'MATERIAL' | 'PENDING_POST' | 'POST',
    text: string,
    organizationId: string
  ): Promise<string>;

  /**
   * Generate embedding without storing
   */
  generateEmbedding(text: string): Promise<number[]>;
}

// =============================================================================
// Similarity Service Implementation
// =============================================================================

export interface SimilarityServiceDeps {
  db: Database;
  aiAdapter: AIAdapter;
  similarityThreshold?: number;
  recentDays?: number;
}

/**
 * Create a similarity service
 */
export function createSimilarityService(deps: SimilarityServiceDeps): SimilarityService {
  const { db, aiAdapter } = deps;
  const defaultThreshold = deps.similarityThreshold ?? 0.85;
  const recentDays = deps.recentDays ?? 30;

  return {
    async checkSimilarity(
      text: string,
      organizationId: string,
      threshold?: number
    ): Promise<SimilarContent[]> {
      const effectiveThreshold = threshold ?? defaultThreshold;

      try {
        // Generate embedding for the input text
        const embedding = await aiAdapter.generateEmbedding(text);

        // Format embedding as PostgreSQL vector literal
        const vectorLiteral = `[${embedding.join(',')}]`;

        // Query for similar content using pgvector cosine distance
        // The <=> operator computes cosine distance (0 = identical, 2 = opposite)
        // We want similarity score (1 - distance)
        const result = await db.execute(sql`
          SELECT
            ce.content_id as id,
            ce.content_type as "contentType",
            1 - (ce.embedding <=> ${vectorLiteral}::vector) as similarity
          FROM content_embeddings ce
          WHERE ce.organization_id = ${organizationId}
            AND ce.created_at > NOW() - INTERVAL '${sql.raw(String(recentDays))} days'
            AND 1 - (ce.embedding <=> ${vectorLiteral}::vector) >= ${effectiveThreshold}
          ORDER BY similarity DESC
          LIMIT 10
        `);

        // Cast result to expected shape
        const rows = result as unknown as SimilarContent[];

        logger.debug('Similarity check result', {
          organizationId,
          threshold: effectiveThreshold,
          matchCount: rows.length,
          topSimilarity: rows[0]?.similarity?.toFixed(3),
        });

        return rows;
      } catch (error) {
        logger.error('Similarity check failed', error);
        // On error, return empty array to avoid blocking content
        return [];
      }
    },

    async storeEmbedding(
      contentId: string,
      contentType: 'MATERIAL' | 'PENDING_POST' | 'POST',
      text: string,
      organizationId: string
    ): Promise<string> {
      // Generate embedding
      const embedding = await aiAdapter.generateEmbedding(text);
      const vectorLiteral = `[${embedding.join(',')}]`;

      // Create hash of content for change detection
      const contentHash = await hashContent(text);

      // Insert or update embedding
      const result = await db.execute(sql`
        INSERT INTO content_embeddings (
          id,
          organization_id,
          content_type,
          content_id,
          embedding,
          content_hash,
          created_at
        ) VALUES (
          gen_random_uuid()::text,
          ${organizationId},
          ${contentType},
          ${contentId},
          ${vectorLiteral}::vector,
          ${contentHash},
          NOW()
        )
        ON CONFLICT (content_type, content_id)
        DO UPDATE SET
          embedding = EXCLUDED.embedding,
          content_hash = EXCLUDED.content_hash,
          created_at = NOW()
        RETURNING id
      `);

      const rows = result as unknown as Array<{ id: string }>;
      const embeddingId = rows[0]?.id;

      logger.debug('Embedding stored', {
        contentId,
        contentType,
        embeddingId,
        organizationId,
      });

      return embeddingId;
    },

    async generateEmbedding(text: string): Promise<number[]> {
      return aiAdapter.generateEmbedding(text);
    },
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate a hash of content for change detection
 */
async function hashContent(text: string): Promise<string> {
  // Use a simple hash for change detection
  // In production, consider using crypto.subtle.digest
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}
