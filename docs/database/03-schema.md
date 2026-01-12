# Drizzle Schema Definitions

## Enums

```typescript
// packages/database/src/schema/enums.ts
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
```

## User (Better Auth)

```typescript
// packages/database/src/schema/users.ts
import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

## Organization & Membership

```typescript
// packages/database/src/schema/organization.ts
import { pgTable, text, boolean, timestamp, integer, unique } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';
import { memberRole, subscriptionTier, subscriptionStatus, creditAction } from './enums';

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  stripeCustomerId: text('stripe_customer_id'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const organizationMembers = pgTable('organization_members', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: memberRole('role').notNull().default('MEMBER'),
  invitedAt: timestamp('invited_at'),
  joinedAt: timestamp('joined_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueMember: unique().on(table.organizationId, table.userId),
}));

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .unique(),
  tier: subscriptionTier('tier').notNull().default('FREE'),
  status: subscriptionStatus('status').notNull().default('ACTIVE'),
  creditsTotal: integer('credits_total').notNull().default(0),
  creditsUsed: integer('credits_used').notNull().default(0),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const creditTransactions = pgTable('credit_transactions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id),
  subscriptionId: text('subscription_id')
    .references(() => subscriptions.id),
  amount: integer('amount').notNull(),
  action: creditAction('action').notNull(),
  description: text('description'),
  relatedPostId: text('related_post_id'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

## BrandProfile, SocialAccount, BrandProfileAccount, Schedule

```typescript
// packages/database/src/schema/brand-profile.ts
import { pgTable, text, boolean, timestamp, integer, jsonb, unique } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organization';
import {
  socialPlatform, visualStyle, fontPreference
} from './enums';
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
  isDefault: boolean('is_default').default(false),  // Default for this platform
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
  daysOfWeek: integer('days_of_week').array().default([1,2,3,4,5]),

  materialStrategy: text('material_strategy').default('round_robin'),
  autoApprove: boolean('auto_approve').default(true),
  uniquePerPlatform: boolean('unique_per_platform').default(false),

  isActive: boolean('is_active').default(true),
  nextRunAt: timestamp('next_run_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

## Material & ExternalSource

```typescript
// packages/database/src/schema/material.ts
import { pgTable, text, boolean, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organization';
import { brandProfiles } from './brand-profile';
import { contentEmbeddings } from './embedding';
import { materialType, materialStatus, contentAngle } from './enums';
import type { ExternalSourceConfig } from '../types';

export const materials = pgTable('materials', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id),
  brandProfileId: text('brand_profile_id')
    .references(() => brandProfiles.id, { onDelete: 'set null' }),

  // Source
  type: materialType('type').notNull(),
  name: text('name'),
  originalContent: text('original_content'),
  fileKey: text('file_key'),
  fileSize: integer('file_size'),
  mimeType: text('mime_type'),
  url: text('url'),

  // AI Analysis Results
  summary: text('summary'),
  keyPoints: text('key_points').array().default([]),
  keywords: text('keywords').array().default([]),
  suggestedAngles: contentAngle('suggested_angles').array().default([]),
  sentiment: text('sentiment'),
  contentPillar: text('content_pillar'),

  // Status & Usage
  status: materialStatus('status').default('UPLOADED'),
  usageCount: integer('usage_count').default(0),
  lastUsedAt: timestamp('last_used_at'),

  // Embedding
  embeddingId: text('embedding_id')
    .references(() => contentEmbeddings.id),

  // Meta
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const externalSources = pgTable('external_sources', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id),
  brandProfileId: text('brand_profile_id').notNull()
    .references(() => brandProfiles.id, { onDelete: 'cascade' }),

  type: text('type').notNull(),
  name: text('name').notNull(),
  storeUrl: text('store_url'),

  // Connection config (encrypted JSON)
  connectionConfig: jsonb('connection_config').$type<ExternalSourceConfig>().default({}),

  lastCrawlAt: timestamp('last_crawl_at'),
  crawlFrequency: text('crawl_frequency').default('0 0 * * *'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

## Post & PendingPost

```typescript
// packages/database/src/schema/post.ts
import { pgTable, text, boolean, timestamp, integer, real } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organization';
import { brandProfiles, socialAccounts, schedules } from './brand-profile';
import { materials } from './material';
import { contentEmbeddings } from './embedding';
import { socialPlatform, contentAngle, pendingPostStatus } from './enums';

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

  // Embedding
  embeddingId: text('embedding_id')
    .references(() => contentEmbeddings.id),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

## ContentEmbedding (pgvector)

```typescript
// packages/database/src/schema/embedding.ts
import { pgTable, text, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organization';
import { contentType } from './enums';

export const contentEmbeddings = pgTable('content_embeddings', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id),
  contentType: contentType('content_type').notNull(),
  contentId: text('content_id').notNull(),
  embedding: vector('embedding', { dimensions: 768 }).notNull(),
  contentHash: text('content_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueContent: unique().on(table.contentType, table.contentId),
  embeddingIdx: index('embedding_idx')
    .using('ivfflat', table.embedding.op('vector_cosine_ops')),
  orgIdx: index('embedding_org_idx').on(table.organizationId),
}));
```

## Schema Index Export

```typescript
// packages/database/src/schema/index.ts
export * from './enums';
export * from './users';
export * from './organization';
export * from './brand-profile';
export * from './material';
export * from './post';
export * from './embedding';
```

## Database Connection

```typescript
// packages/database/src/db.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);

export const db = drizzle(client, { schema });
export type Database = typeof db;
```

## Drizzle Config

```typescript
// packages/database/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

*Related: [Types](./04-types.md) | [Indexes](./05-indexes.md)*
