import { pgTable, text, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organization';
import { contentType } from './enums';

// ContentEmbedding - pgvector for content deduplication
// Uses 768-dimensional vectors (common for many embedding models)
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

// Type exports
export type ContentEmbedding = typeof contentEmbeddings.$inferSelect;
export type NewContentEmbedding = typeof contentEmbeddings.$inferInsert;
