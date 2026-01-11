// Social Platform Types
export type SocialPlatform =
  | 'FACEBOOK'
  | 'TWITTER'
  | 'LINKEDIN'
  | 'INSTAGRAM'
  | 'YOUTUBE'
  | 'REDDIT'
  | 'TIKTOK';

// Subscription Tiers
export type SubscriptionTier = 'FREE' | 'STARTER' | 'GROWTH' | 'BUSINESS';

// Material Types
export type MaterialType = 'IMAGE' | 'VIDEO' | 'TEXT';
export type MaterialStatus = 'UNUSED' | 'USED_ONCE' | 'USED_MULTIPLE';

// Post Status
export type PostStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED';

// Credit Configuration by Tier
export const TIER_CREDITS: Record<SubscriptionTier, number> = {
  FREE: 10,
  STARTER: 100,
  GROWTH: 500,
  BUSINESS: 2000,
};

// Credit Costs per Action
export const CREDIT_COSTS = {
  TEXT_GENERATION: 1,
  IMAGE_ANALYSIS: 2,
  VIDEO_ANALYSIS: 5,
  IMAGE_GENERATION: 10,
  VIDEO_GENERATION: 50,
  PUBLISH_POST: 1,
} as const;

// Platform Character Limits
export const PLATFORM_LIMITS: Record<
  SocialPlatform,
  { maxChars: number; maxImages: number; maxVideos: number }
> = {
  FACEBOOK: { maxChars: 63206, maxImages: 10, maxVideos: 1 },
  TWITTER: { maxChars: 280, maxImages: 4, maxVideos: 1 },
  LINKEDIN: { maxChars: 3000, maxImages: 20, maxVideos: 1 },
  INSTAGRAM: { maxChars: 2200, maxImages: 10, maxVideos: 1 },
  YOUTUBE: { maxChars: 5000, maxImages: 0, maxVideos: 1 },
  REDDIT: { maxChars: 40000, maxImages: 20, maxVideos: 1 },
  TIKTOK: { maxChars: 2200, maxImages: 0, maxVideos: 1 },
};
