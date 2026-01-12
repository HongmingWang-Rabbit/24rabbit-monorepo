import { pgTable, text, boolean, timestamp, integer, jsonb, unique } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organization';
import { socialPlatform, visualStyle, fontPreference } from './enums';
import type {
  BrandColors, LanguageRules, ExamplePost, ContentPillar, PlatformSettings
} from '../types';

export const brandProfiles = pgTable('brand_profiles', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  // Identity (Visual)
  name: text('name').notNull(),
  logo: text('logo'),
  icon: text('icon'),
  colors: jsonb('colors').$type<BrandColors>().default({}),
  visualStyle: visualStyle('visual_style').default('MINIMAL'),
  fontPreference: fontPreference('font_preference').default('MODERN'),

  // Voice (Tone & Language)
  tone: text('tone').array().default([]),
  personality: text('personality'),
  languageRules: jsonb('language_rules').$type<LanguageRules>().default({}),
  examplePosts: jsonb('example_posts').$type<ExamplePost[]>().default([]),

  // Context
  customContext: text('custom_context'),
  targetAudience: text('target_audience'),
  contentPillars: jsonb('content_pillars').$type<ContentPillar[]>().default([]),

  // Platform Settings
  platformSettings: jsonb('platform_settings').$type<PlatformSettings>().default({}),

  // Defaults (autonomous agent)
  autoApprove: boolean('auto_approve').default(true),

  // Notification Settings (for approval workflow)
  notifyEmail: text('notify_email'),
  notifyWebhook: text('notify_webhook'),
  approvalTimeout: integer('approval_timeout').default(24),

  // Meta
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// SocialAccount belongs to Organization (not BrandProfile)
// Linked to brands via N:M join table
export const socialAccounts = pgTable('social_accounts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id),

  platform: socialPlatform('platform').notNull(),
  accountId: text('account_id').notNull(),
  accountName: text('account_name').notNull(),
  accountType: text('account_type'),
  profileUrl: text('profile_url'),
  avatarUrl: text('avatar_url'),

  // OAuth tokens (encrypted)
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),

  isActive: boolean('is_active').default(true),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueAccount: unique().on(table.platform, table.accountId),
}));

// Join table: BrandProfile ↔ SocialAccount (N:M)
// Allows one account to be used by multiple brands
export const brandProfileAccounts = pgTable('brand_profile_accounts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  brandProfileId: text('brand_profile_id').notNull()
    .references(() => brandProfiles.id, { onDelete: 'cascade' }),
  socialAccountId: text('social_account_id').notNull()
    .references(() => socialAccounts.id, { onDelete: 'cascade' }),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniquePair: unique().on(table.brandProfileId, table.socialAccountId),
}));

export const schedules = pgTable('schedules', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  brandProfileId: text('brand_profile_id').notNull()
    .references(() => brandProfiles.id, { onDelete: 'cascade' }),

  name: text('name'),
  platforms: socialPlatform('platforms').array().default([]),
  frequency: text('frequency').notNull().default('1_per_day'),
  times: text('times').array().default([]),
  timezone: text('timezone').notNull().default('UTC'),
  daysOfWeek: integer('days_of_week').array().default([1, 2, 3, 4, 5]),

  materialStrategy: text('material_strategy').default('round_robin'),
  autoApprove: boolean('auto_approve').default(true),
  uniquePerPlatform: boolean('unique_per_platform').default(false),

  isActive: boolean('is_active').default(true),
  nextRunAt: timestamp('next_run_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Type exports
export type BrandProfile = typeof brandProfiles.$inferSelect;
export type NewBrandProfile = typeof brandProfiles.$inferInsert;
export type SocialAccount = typeof socialAccounts.$inferSelect;
export type NewSocialAccount = typeof socialAccounts.$inferInsert;
export type BrandProfileAccount = typeof brandProfileAccounts.$inferSelect;
export type NewBrandProfileAccount = typeof brandProfileAccounts.$inferInsert;
export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
