# Index Strategy

## Design Goals

Optimized for **medium scale** (1K-10K organizations):

1. Fast organization-scoped queries (most common pattern)
2. Efficient time-based scheduling queries
3. Fast vector similarity searches
4. Platform-specific lookups

## Index Categories

### 1. Organization-Scoped Indexes

Most queries filter by `organization_id` first. These indexes optimize the most common access patterns.

```sql
-- Brand profiles by organization
CREATE INDEX idx_brand_profiles_org
  ON brand_profiles(organization_id);

-- Social accounts by organization
CREATE INDEX idx_social_accounts_org
  ON social_accounts(organization_id);

-- Materials by organization
CREATE INDEX idx_materials_org
  ON materials(organization_id);

-- Materials by organization and status (common filter)
CREATE INDEX idx_materials_org_status
  ON materials(organization_id, status);

-- Posts by organization
CREATE INDEX idx_posts_org
  ON posts(organization_id);

-- Pending posts by organization and status
CREATE INDEX idx_pending_posts_org_status
  ON pending_posts(organization_id, status);

-- Embeddings by organization
CREATE INDEX idx_embeddings_org
  ON content_embeddings(organization_id);
```

### 2. Time-Based Scheduling Indexes

Cron jobs query for schedules and posts by time.

```sql
-- Active schedules ready to run
CREATE INDEX idx_schedules_next_run
  ON schedules(next_run_at)
  WHERE is_active = true;

-- Pending posts scheduled for publication
CREATE INDEX idx_pending_posts_scheduled
  ON pending_posts(scheduled_for)
  WHERE status IN ('PENDING', 'AUTO_APPROVED');

-- Posts by publication time (for analytics)
CREATE INDEX idx_posts_published_at
  ON posts(published_at DESC);

-- Subscription period lookups
CREATE INDEX idx_subscriptions_period_end
  ON subscriptions(current_period_end);
```

### 3. Vector Similarity Index (pgvector)

For content deduplication using 768-dimensional embeddings.

```sql
-- IVFFlat index for approximate nearest neighbor search
-- lists=100 is suitable for up to ~1M vectors
CREATE INDEX idx_embeddings_vector
  ON content_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

**Index parameters:**
- `lists = 100`: Number of clusters. Rule of thumb: `sqrt(rows)` for optimal performance
- `vector_cosine_ops`: Use cosine distance (normalized vectors)

**Query example:**
```sql
SELECT *
FROM content_embeddings
WHERE organization_id = $1
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY embedding <=> $2  -- cosine distance
LIMIT 5;
```

### 4. Platform-Specific Indexes

For platform analytics and account lookups.

```sql
-- Posts by platform and time
CREATE INDEX idx_posts_platform
  ON posts(platform, published_at);

-- Unique social account lookup
CREATE INDEX idx_social_accounts_platform
  ON social_accounts(platform, account_id);

-- Posts by social account
CREATE INDEX idx_posts_social_account
  ON posts(social_account_id, published_at);
```

### 5. Unique Constraints

Enforced at database level.

```sql
-- One subscription per organization
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_organization_id_unique
  UNIQUE (organization_id);

-- One membership per user per organization
ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_org_user_unique
  UNIQUE (organization_id, user_id);

-- One embedding per content item
ALTER TABLE content_embeddings
  ADD CONSTRAINT content_embeddings_type_id_unique
  UNIQUE (content_type, content_id);

-- One account connection per platform account
ALTER TABLE social_accounts
  ADD CONSTRAINT social_accounts_platform_account_unique
  UNIQUE (platform, account_id);
```

## Drizzle Index Definitions

```typescript
// In schema files, indexes are defined in the table callback

export const materials = pgTable('materials', {
  // ... columns
}, (table) => ({
  orgIdx: index('idx_materials_org').on(table.organizationId),
  orgStatusIdx: index('idx_materials_org_status')
    .on(table.organizationId, table.status),
}));

export const contentEmbeddings = pgTable('content_embeddings', {
  // ... columns
}, (table) => ({
  uniqueContent: unique().on(table.contentType, table.contentId),
  embeddingIdx: index('embedding_idx')
    .using('ivfflat', table.embedding.op('vector_cosine_ops')),
  orgIdx: index('embedding_org_idx').on(table.organizationId),
}));
```

## Query Optimization Tips

### Use Organization Filter First

```typescript
// Good: Organization filter uses index
const materials = await db.query.materials.findMany({
  where: and(
    eq(materials.organizationId, orgId),
    eq(materials.status, 'READY')
  ),
});

// Bad: Status filter alone requires full scan
const materials = await db.query.materials.findMany({
  where: eq(materials.status, 'READY'),
});
```

### Limit Vector Search Results

```typescript
// Good: Limit results for vector search
const similar = await db.execute(sql`
  SELECT * FROM content_embeddings
  WHERE organization_id = ${orgId}
  ORDER BY embedding <=> ${vector}
  LIMIT 10
`);

// Bad: No limit on vector search
const similar = await db.execute(sql`
  SELECT * FROM content_embeddings
  WHERE organization_id = ${orgId}
  ORDER BY embedding <=> ${vector}
`);
```

### Use Partial Indexes for Common Filters

```sql
-- Only index active schedules
CREATE INDEX idx_schedules_active_next_run
  ON schedules(next_run_at)
  WHERE is_active = true AND deleted_at IS NULL;
```

## Performance Monitoring

### Check Index Usage

```sql
-- Find unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY tablename;

-- Find missing indexes (sequential scans on large tables)
SELECT schemaname, relname, seq_scan, seq_tup_read
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_tup_read DESC;
```

### Analyze Query Performance

```sql
EXPLAIN ANALYZE
SELECT * FROM materials
WHERE organization_id = 'org_123'
  AND status = 'READY'
ORDER BY created_at DESC
LIMIT 10;
```

## Scaling Considerations

### Current Scale (1K-10K orgs)

- B-tree indexes sufficient for most queries
- IVFFlat index handles up to ~1M vectors efficiently
- No partitioning needed

### Future Scale (10K+ orgs)

Consider:
- Table partitioning by `organization_id` for very large tables
- HNSW index for vectors (better recall, more memory)
- Read replicas for analytics queries
- Materialized views for dashboard aggregations

---

*Related: [Schema](./03-schema.md) | [Patterns](./06-patterns.md)*
