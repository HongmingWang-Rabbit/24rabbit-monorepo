# TypeScript Types for JSON Fields

## Overview

Several database fields use JSONB for complex, nested data that is always read/written as a unit. This document defines the TypeScript interfaces for these JSON structures.

## Type Definitions

```typescript
// packages/database/src/types.ts

import type { SocialPlatform } from './schema/enums';

// ============================================
// BrandProfile JSON Fields
// ============================================

/**
 * Brand color palette
 * All values are hex color codes
 */
export interface BrandColors {
  primary: string;      // Main brand color, e.g., "#6366F1"
  secondary: string;    // Secondary color, e.g., "#EC4899"
  accent: string;       // Accent/highlight, e.g., "#10B981"
  background: string;   // Background color, e.g., "#FFFFFF"
  text: string;         // Text color, e.g., "#1F2937"
}

/**
 * Language and writing style rules
 */
export interface LanguageRules {
  /** Words/phrases to include in content */
  wordsToUse: string[];

  /** Words/phrases to avoid */
  wordsToAvoid: string[];

  /** Emoji usage preference */
  emojiUsage: 'none' | 'minimal' | 'moderate' | 'heavy';

  /** Hashtag usage preference */
  hashtagStyle: 'none' | 'minimal' | 'moderate' | 'heavy';

  /** Call-to-action style */
  ctaStyle: 'none' | 'soft' | 'direct';
}

/**
 * Example post for brand voice reference
 */
export interface ExamplePost {
  /** Target platform for this example */
  platform: SocialPlatform;

  /** The example content */
  content: string;
}

/**
 * Content pillar definition for balanced content mix
 */
export interface ContentPillar {
  /** Pillar name, e.g., "Product Updates" */
  name: string;

  /** Target percentage of content, e.g., 40 */
  percentage: number;
}

/**
 * Per-platform settings and overrides
 */
export interface PlatformSettings {
  [platform: string]: {
    /** Whether this platform is enabled */
    enabled: boolean;

    /** Override tone for this platform */
    toneOverride?: string[];

    /** Override custom context for this platform */
    customContextOverride?: string;

    /** Default hashtags for this platform */
    hashtagsDefault?: string[];
  };
}

// ============================================
// ExternalSource JSON Fields
// ============================================

/**
 * E-commerce platform connection configuration
 * All sensitive fields are encrypted at rest
 */
export interface ExternalSourceConfig {
  /** API key for the external service */
  apiKey?: string;

  /** API secret for the external service */
  apiSecret?: string;

  /** Store/shop URL */
  storeUrl?: string;

  /** Webhook secret for incoming notifications */
  webhookSecret?: string;

  /** Access token (for OAuth-based integrations) */
  accessToken?: string;

  /** Additional platform-specific settings */
  [key: string]: string | undefined;
}

// ============================================
// Enums as TypeScript Types
// ============================================

/**
 * Social platform identifiers
 */
export type SocialPlatform =
  | 'FACEBOOK'
  | 'TWITTER'
  | 'LINKEDIN'
  | 'INSTAGRAM'
  | 'YOUTUBE'
  | 'REDDIT'
  | 'TIKTOK'
  | 'THREADS';

/**
 * Organization member roles
 */
export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

/**
 * Subscription tiers
 */
export type SubscriptionTier = 'FREE' | 'STARTER' | 'GROWTH' | 'BUSINESS' | 'ENTERPRISE';

/**
 * Subscription status
 */
export type SubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'TRIALING' | 'PAUSED';

/**
 * Credit transaction actions
 */
export type CreditAction =
  | 'GENERATE'
  | 'GENERATE_TRENDING'
  | 'REWRITE'
  | 'PUBLISH'
  | 'ANALYTICS'
  | 'TOPUP'
  | 'SUBSCRIPTION';

/**
 * Visual style options for brand
 */
export type VisualStyle = 'MINIMAL' | 'BOLD' | 'PLAYFUL' | 'CORPORATE' | 'LUXURY' | 'TECH';

/**
 * Font preference options
 */
export type FontPreference = 'MODERN' | 'CLASSIC' | 'HANDWRITTEN' | 'MONOSPACE';

/**
 * Content angle categories (AI-selected)
 */
export type ContentAngle =
  | 'PRODUCT_FOCUS'   // Features, specs, what it is
  | 'USER_BENEFIT'    // How it helps the user
  | 'STORYTELLING'    // Narrative, emotional connection
  | 'EDUCATIONAL'     // Tips, how-to, industry insights
  | 'SOCIAL_PROOF'    // Testimonials, case studies
  | 'PROMOTIONAL';    // Sales, discounts, urgency

/**
 * Material types
 */
export type MaterialType = 'TEXT' | 'URL' | 'FILE' | 'IMAGE' | 'VIDEO';

/**
 * Material processing status
 */
export type MaterialStatus =
  | 'UPLOADED'    // Just uploaded, pending processing
  | 'PROCESSING'  // Being analyzed by AI
  | 'ANALYZED'    // Analysis complete, pending embedding
  | 'READY'       // Ready for content generation
  | 'USED'        // Used in at least one post
  | 'ARCHIVED'    // User archived, won't be selected
  | 'FAILED';     // Processing failed

/**
 * Pending post status
 */
export type PendingPostStatus =
  | 'PENDING'       // Waiting for approval (if required)
  | 'AUTO_APPROVED' // Auto-approved, ready to publish
  | 'PUBLISHED'     // Successfully published
  | 'FAILED';       // Publishing failed after retries

/**
 * Content type for embeddings (polymorphic)
 */
export type ContentType = 'MATERIAL' | 'PENDING_POST' | 'POST';

/**
 * Material selection strategies for scheduling
 */
export type MaterialStrategy =
  | 'round_robin'     // Use each material once before reusing
  | 'random'          // Random selection from pool
  | 'weighted'        // Favor high-engagement materials
  | 'pillar_balanced'; // Match content pillar percentages

/**
 * Schedule frequency options
 */
export type ScheduleFrequency =
  | '1_per_day'
  | '2_per_day'
  | '3_per_day'
  | 'weekly'
  | 'custom';

/**
 * Generation mode for posts
 */
export type GenerationMode = 'autopilot' | 'manual';
```

## Usage Examples

### Creating a BrandProfile

```typescript
import { db } from './db';
import { brandProfiles } from './schema';
import type { BrandColors, LanguageRules, ContentPillar } from './types';

const colors: BrandColors = {
  primary: '#6366F1',
  secondary: '#EC4899',
  accent: '#10B981',
  background: '#FFFFFF',
  text: '#1F2937',
};

const languageRules: LanguageRules = {
  wordsToUse: ['innovative', 'seamless', 'powerful'],
  wordsToAvoid: ['synergy', 'leverage', 'disrupt'],
  emojiUsage: 'minimal',
  hashtagStyle: 'moderate',
  ctaStyle: 'soft',
};

const contentPillars: ContentPillar[] = [
  { name: 'Product Updates', percentage: 40 },
  { name: 'Tips & Guides', percentage: 35 },
  { name: 'Industry News', percentage: 25 },
];

await db.insert(brandProfiles).values({
  organizationId: 'org_123',
  name: 'My Brand',
  colors,
  languageRules,
  contentPillars,
  tone: ['professional', 'friendly', 'helpful'],
  targetAudience: 'Small business owners in tech',
});
```

### Reading JSON Fields

```typescript
import { db } from './db';
import { brandProfiles } from './schema';
import { eq } from 'drizzle-orm';

const brand = await db.query.brandProfiles.findFirst({
  where: eq(brandProfiles.id, 'bp_123'),
});

// TypeScript knows the structure
const primaryColor = brand?.colors?.primary;  // string | undefined
const emojiUsage = brand?.languageRules?.emojiUsage;  // 'none' | 'minimal' | 'moderate' | 'heavy' | undefined
```

### Type Guards

```typescript
function isValidBrandColors(obj: unknown): obj is BrandColors {
  if (typeof obj !== 'object' || obj === null) return false;
  const colors = obj as Record<string, unknown>;
  return (
    typeof colors.primary === 'string' &&
    typeof colors.secondary === 'string' &&
    typeof colors.accent === 'string' &&
    typeof colors.background === 'string' &&
    typeof colors.text === 'string'
  );
}
```

## Default Values

```typescript
// packages/database/src/defaults.ts

export const DEFAULT_BRAND_COLORS: BrandColors = {
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  accent: '#10B981',
  background: '#FFFFFF',
  text: '#1F2937',
};

export const DEFAULT_LANGUAGE_RULES: LanguageRules = {
  wordsToUse: [],
  wordsToAvoid: [],
  emojiUsage: 'minimal',
  hashtagStyle: 'moderate',
  ctaStyle: 'soft',
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {};
```

---

*Related: [Schema](./03-schema.md) | [Patterns](./06-patterns.md)*
