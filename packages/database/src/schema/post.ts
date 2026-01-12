import { pgTable, text, boolean, timestamp, integer, real } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organization';
import { brandProfiles, socialAccounts, schedules } from './brand-profile';
import { materials } from './material';
import { socialPlatform, contentAngle, pendingPostStatus } from './enums';

export const pendingPosts = pgTable('pending_posts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id),
  brandProfileId: text('brand_profile_id').notNull()
    .references(() => brandProfiles.id),
  materialId: text('material_id').notNull()
    .references(() => materials.id),
  scheduleId: text('schedule_id')
    .references(() => schedules.id),

  // Target platforms
  platforms: socialPlatform('platforms').array().notNull(),

  // Generated content
  content: text('content').notNull(),
  hashtags: text('hashtags').array().default([]),
  mediaUrls: text('media_urls').array().default([]),

  // AI metadata
  angle: contentAngle('angle').notNull(),
  angleReason: text('angle_reason'),
  generationMode: text('generation_mode').notNull().default('autopilot'),

  // Scheduling
  scheduledFor: timestamp('scheduled_for'),
  expiresAt: timestamp('expires_at'),

  // Status
  status: pendingPostStatus('status').notNull().default('PENDING'),

  // Embedding reference
  embeddingId: text('embedding_id'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const posts = pgTable('posts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id),
  brandProfileId: text('brand_profile_id').notNull()
    .references(() => brandProfiles.id),
  socialAccountId: text('social_account_id').notNull()
    .references(() => socialAccounts.id),
  materialId: text('material_id')
    .references(() => materials.id),
  scheduleId: text('schedule_id')
    .references(() => schedules.id),
  pendingPostId: text('pending_post_id')
    .references(() => pendingPosts.id),

  // Content
  content: text('content').notNull(),
  hashtags: text('hashtags').array().default([]),
  mediaUrls: text('media_urls').array().default([]),

  // Platform reference
  platform: socialPlatform('platform').notNull(),
  externalId: text('external_id'),
  externalUrl: text('external_url'),
  publishedAt: timestamp('published_at'),

  // Analytics metadata (AI-selected)
  angle: contentAngle('angle').notNull(),
  angleReason: text('angle_reason'),
  isExploration: boolean('is_exploration').default(false),

  // Metrics (updated hourly)
  likes: integer('likes').default(0),
  comments: integer('comments').default(0),
  shares: integer('shares').default(0),
  impressions: integer('impressions').default(0),
  reach: integer('reach').default(0),
  clicks: integer('clicks').default(0),
  engagementRate: real('engagement_rate'),
  metricsUpdatedAt: timestamp('metrics_updated_at'),

  // Meta
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Type exports
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type PendingPost = typeof pendingPosts.$inferSelect;
export type NewPendingPost = typeof pendingPosts.$inferInsert;
