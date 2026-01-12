import { pgTable, text, boolean, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organization';
import { brandProfiles } from './brand-profile';
import { materialType, materialStatus, contentAngle } from './enums';
import type { ExternalSourceConfig } from '../types';

export const materials = pgTable('materials', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id),
  brandProfileId: text('brand_profile_id').references(() => brandProfiles.id, {
    onDelete: 'set null',
  }),

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

  // Embedding reference (FK added after embedding table is defined)
  embeddingId: text('embedding_id'),

  // Meta
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const externalSources = pgTable('external_sources', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id),
  brandProfileId: text('brand_profile_id')
    .notNull()
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

// Type exports
export type Material = typeof materials.$inferSelect;
export type NewMaterial = typeof materials.$inferInsert;
export type ExternalSource = typeof externalSources.$inferSelect;
export type NewExternalSource = typeof externalSources.$inferInsert;
