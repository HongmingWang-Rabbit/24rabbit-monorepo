import type { SocialPlatform } from './schema/enums';

/**
 * BrandProfile JSON field types
 */

// Brand color palette
export interface BrandColors {
  primary?: string;      // e.g., "#6366F1"
  secondary?: string;    // e.g., "#EC4899"
  accent?: string;       // e.g., "#10B981"
  background?: string;   // e.g., "#FFFFFF"
  text?: string;         // e.g., "#1F2937"
}

// Language and content rules
export interface LanguageRules {
  wordsToUse?: string[];
  wordsToAvoid?: string[];
  emojiUsage?: 'none' | 'minimal' | 'moderate' | 'heavy';
  hashtagStyle?: 'none' | 'minimal' | 'moderate' | 'heavy';
  ctaStyle?: 'none' | 'soft' | 'direct';
}

// Example post for training/reference
export interface ExamplePost {
  platform: SocialPlatform;
  content: string;
}

// Content pillar with percentage allocation
export interface ContentPillar {
  name: string;        // e.g., "Product Updates"
  percentage: number;  // e.g., 40
}

// Per-platform settings override
export interface PlatformSettings {
  [platform: string]: {
    enabled?: boolean;
    toneOverride?: string[];
    customContextOverride?: string;
    hashtagsDefault?: string[];
  };
}

/**
 * ExternalSource JSON field types
 */

// Connection config for external platforms (encrypted)
export interface ExternalSourceConfig {
  apiKey?: string;
  apiSecret?: string;
  storeUrl?: string;
  webhookSecret?: string;
}
