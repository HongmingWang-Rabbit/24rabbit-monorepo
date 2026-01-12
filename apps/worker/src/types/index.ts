/**
 * Worker-specific Type Definitions
 */

import type { Job } from 'bullmq';
import type { SocialPlatform } from '@24rabbit/shared';

// =============================================================================
// Processor Types
// =============================================================================

/** Generic job processor function signature */
export type JobProcessor<T> = (job: Job<T>) => Promise<void>;

/** Processor factory with dependency injection */
export type ProcessorFactory<T, D> = (deps: D) => JobProcessor<T>;

// =============================================================================
// Material Extraction Types
// =============================================================================

export interface ExtractedContent {
  text: string;
  metadata: Record<string, unknown>;
}

export interface MaterialAnalysis {
  summary: string;
  keyPoints: string[];
  keywords: string[];
  contentType: string;
  suggestedAngles: string[];
  sentiment: string;
  targetAudience?: string;
}

// =============================================================================
// Content Generation Types
// =============================================================================

export interface ContentVariation {
  content: string;
  angle: string;
  hashtags: string[];
  characterCount: number;
}

export interface GenerationResult {
  variations: ContentVariation[];
  platform: SocialPlatform;
}

export interface BrandContext {
  name: string;
  customContext?: string | null;
  targetAudience?: string | null;
  personality?: string | null;
  tone: string[];
  languageRules: {
    wordsToUse?: string[];
    wordsToAvoid?: string[];
    emojiUsage?: string;
    hashtagStyle?: string;
    ctaStyle?: string;
  };
  examplePosts: Array<{ platform: string; content: string }>;
  platformSettings: Record<string, unknown>;
}

// =============================================================================
// Platform Types
// =============================================================================

export interface PlatformCredentials {
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  accountId: string;
  pageId?: string;
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
  publishedAt?: Date;
}

export interface PlatformMetrics {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  clicks: number;
}

// =============================================================================
// Rate Limiting Types
// =============================================================================

export interface RateLimitResult {
  allowed: boolean;
  reason?: 'minute_limit' | 'hour_limit' | 'day_limit';
  retryAfter?: number; // seconds
  current?: number;
  limit?: number;
}

export interface RateLimitConfig {
  postsPerDay: number;
  postsPerHour: number;
  postsPerMinute: number;
}

// =============================================================================
// Similarity Types
// =============================================================================

export interface SimilarityResult {
  score: number;
  isUnique: boolean;
  mostSimilarPostId?: string;
}

/** Individual similar content match */
export interface SimilarContent {
  id: string;
  contentType: string;
  similarity: number;
}

// =============================================================================
// Scheduler Types
// =============================================================================

export interface SchedulerOptions {
  intervalMs: number;
  lockKey: string;
  lockTtlSeconds: number;
}

export interface ScheduleExecution {
  scheduleId: string;
  materialId: string;
  brandProfileId: string;
  platforms: SocialPlatform[];
  scheduledFor: Date;
}
