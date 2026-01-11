import type { SocialPlatform } from '@24rabbit/shared';

// AI Adapter Interface
export interface AIAdapter {
  analyzeImage(imageUrl: string): Promise<ImageAnalysisResult>;
  analyzeVideo(videoUrl: string): Promise<VideoAnalysisResult>;
  generateCopy(params: GenerateCopyParams): Promise<GeneratedCopy>;
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

// Content Generation
export interface GenerateCopyParams {
  platform: SocialPlatform;
  brandTone?: string;
  targetAudience?: string;
  contentDescription: string;
  hashtags?: string[];
  maxLength?: number;
}

export interface GeneratedCopy {
  content: string;
  hashtags: string[];
  estimatedEngagement: 'low' | 'medium' | 'high';
}
