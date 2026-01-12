import type { SocialPlatform } from '@24rabbit/shared';

/** Embedding vector dimension for text-embedding-004 model */
export const EMBEDDING_DIMENSION = 768;

// AI Adapter Interface
export interface AIAdapter {
  analyzeImage(imageUrl: string): Promise<ImageAnalysisResult>;
  analyzeVideo(videoUrl: string, mimeType?: string): Promise<VideoAnalysisResult>;
  generateCopy(options: ContentGenerationOptions): Promise<GeneratedCopy>;
  generateEmbedding(text: string): Promise<number[]>;
}

// Analysis Results
export interface ImageAnalysisResult {
  description: string;
  objects: string[];
  colors: string[];
  mood: string;
  suggestedHashtags: string[];
}

export interface VideoAnalysisResult {
  description: string;
  keyMoments: { timestamp: number; description: string }[];
  transcript?: string;
  suggestedHashtags: string[];
  bestThumbnailTimestamp: number;
}

export interface GeneratedCopy {
  content: string;
  hashtags: string[];
  estimatedEngagement: 'low' | 'medium' | 'high';
  reasoning?: string;
}

// Content Generation Options
export interface ContentGenerationOptions {
  material: {
    summary: string;
    keyPoints: string[];
    keywords: string[];
  };
  brandVoice?: string;
  toneKeywords?: string[];
  targetAudience?: string;
  platform: SocialPlatform;
  maxLength: number;
  includeHashtags?: boolean;
  hashtagCount?: number;
  emojiUsage?: 'none' | 'minimal' | 'moderate' | 'heavy';
  languageRules?: string[];
  examplePosts?: string[];
  angle?: string;
}

// AI Adapter Factory Options
export interface AIAdapterOptions {
  provider: 'gemini' | 'openai' | 'anthropic';
  apiKey: string;
  model?: string;
}
