import { pgEnum } from 'drizzle-orm/pg-core';

// Organization & Auth
export const memberRole = pgEnum('member_role', [
  'OWNER', 'ADMIN', 'MEMBER', 'VIEWER'
]);

// Billing
export const subscriptionTier = pgEnum('subscription_tier', [
  'FREE', 'STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE'
]);

export const subscriptionStatus = pgEnum('subscription_status', [
  'ACTIVE', 'CANCELLED', 'PAST_DUE', 'TRIALING', 'PAUSED'
]);

export const creditAction = pgEnum('credit_action', [
  'GENERATE', 'GENERATE_TRENDING', 'REWRITE', 'PUBLISH', 'ANALYTICS', 'TOPUP', 'SUBSCRIPTION'
]);

// Social Platforms
export const socialPlatform = pgEnum('social_platform', [
  'FACEBOOK', 'TWITTER', 'LINKEDIN', 'INSTAGRAM', 'YOUTUBE', 'REDDIT', 'TIKTOK', 'THREADS'
]);

// Brand
export const visualStyle = pgEnum('visual_style', [
  'MINIMAL', 'BOLD', 'PLAYFUL', 'CORPORATE', 'LUXURY', 'TECH'
]);

export const fontPreference = pgEnum('font_preference', [
  'MODERN', 'CLASSIC', 'HANDWRITTEN', 'MONOSPACE'
]);

// Content
export const contentAngle = pgEnum('content_angle', [
  'PRODUCT_FOCUS', 'USER_BENEFIT', 'STORYTELLING', 'EDUCATIONAL', 'SOCIAL_PROOF', 'PROMOTIONAL'
]);

export const materialType = pgEnum('material_type', [
  'TEXT', 'URL', 'FILE', 'IMAGE', 'VIDEO'
]);

export const materialStatus = pgEnum('material_status', [
  'UPLOADED', 'PROCESSING', 'ANALYZED', 'READY', 'USED', 'ARCHIVED', 'FAILED'
]);

export const pendingPostStatus = pgEnum('pending_post_status', [
  'PENDING', 'AUTO_APPROVED', 'PUBLISHED', 'FAILED'
]);

export const contentType = pgEnum('content_type', [
  'MATERIAL', 'PENDING_POST', 'POST'
]);

// Type exports for use in application code
export type MemberRole = (typeof memberRole.enumValues)[number];
export type SubscriptionTier = (typeof subscriptionTier.enumValues)[number];
export type SubscriptionStatus = (typeof subscriptionStatus.enumValues)[number];
export type CreditAction = (typeof creditAction.enumValues)[number];
export type SocialPlatform = (typeof socialPlatform.enumValues)[number];
export type VisualStyle = (typeof visualStyle.enumValues)[number];
export type FontPreference = (typeof fontPreference.enumValues)[number];
export type ContentAngle = (typeof contentAngle.enumValues)[number];
export type MaterialType = (typeof materialType.enumValues)[number];
export type MaterialStatus = (typeof materialStatus.enumValues)[number];
export type PendingPostStatus = (typeof pendingPostStatus.enumValues)[number];
export type ContentType = (typeof contentType.enumValues)[number];
