# Database Patterns

## Soft Delete

### What is Soft Delete?

Instead of permanently removing records, we mark them as "deleted" by setting a `deletedAt` timestamp:

```typescript
// Table has a deletedAt field
deletedAt: timestamp('deleted_at')  // null = active, timestamp = "deleted"
```

### Why Soft Delete?

| Benefit | Description |
|---------|-------------|
| **Data recovery** | Users can recover accidentally deleted items |
| **GDPR compliance** | Keep records for audit trails before permanent purge |
| **Referential integrity** | Deleted brand's posts still have valid foreign keys |
| **Analytics** | Historical data preserved for reporting |
| **Billing disputes** | Verify what existed during a billing period |

### Tables with Soft Delete

- `users`
- `organizations`
- `social_accounts`
- `brand_profiles`
- `materials`
- `posts`

### Query Patterns

```typescript
import { db } from './db';
import { brandProfiles } from './schema';
import { eq, isNull, and } from 'drizzle-orm';

// Get active brands only (most common)
const activeBrands = await db.query.brandProfiles.findMany({
  where: and(
    eq(brandProfiles.organizationId, orgId),
    isNull(brandProfiles.deletedAt)
  ),
});

// Soft delete a brand
await db.update(brandProfiles)
  .set({ deletedAt: new Date() })
  .where(eq(brandProfiles.id, brandId));

// Restore a deleted brand
await db.update(brandProfiles)
  .set({ deletedAt: null })
  .where(eq(brandProfiles.id, brandId));

// Include deleted items (for admin/audit views)
const allBrands = await db.query.brandProfiles.findMany({
  where: eq(brandProfiles.organizationId, orgId),
});
```

### Permanent Delete (GDPR)

Run periodically to permanently remove old deleted records:

```typescript
import { db } from './db';
import { brandProfiles } from './schema';
import { lt, isNotNull, and } from 'drizzle-orm';

const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

// Permanently delete records soft-deleted over 30 days ago
await db.delete(brandProfiles)
  .where(and(
    isNotNull(brandProfiles.deletedAt),
    lt(brandProfiles.deletedAt, thirtyDaysAgo)
  ));
```

---

## Brand-Account N:M Relationship

### Why N:M?

One social account can be used by multiple brands:

```
SocialAccount "@my_twitter"
├── Used by: "Personal Brand"
└── Used by: "Company Brand"
```

### Query Patterns

```typescript
import { db } from './db';
import { brandProfiles, socialAccounts, brandProfileAccounts } from './schema';
import { eq, and, isNull } from 'drizzle-orm';

// Get all social accounts for a brand
async function getBrandAccounts(brandProfileId: string) {
  return db
    .select({
      account: socialAccounts,
      isDefault: brandProfileAccounts.isDefault,
    })
    .from(brandProfileAccounts)
    .innerJoin(socialAccounts, eq(brandProfileAccounts.socialAccountId, socialAccounts.id))
    .where(and(
      eq(brandProfileAccounts.brandProfileId, brandProfileId),
      isNull(socialAccounts.deletedAt)
    ));
}

// Get all brands using a social account
async function getAccountBrands(socialAccountId: string) {
  return db
    .select({
      brand: brandProfiles,
      isDefault: brandProfileAccounts.isDefault,
    })
    .from(brandProfileAccounts)
    .innerJoin(brandProfiles, eq(brandProfileAccounts.brandProfileId, brandProfiles.id))
    .where(and(
      eq(brandProfileAccounts.socialAccountId, socialAccountId),
      isNull(brandProfiles.deletedAt)
    ));
}

// Link a social account to a brand
async function linkAccountToBrand(
  brandProfileId: string,
  socialAccountId: string,
  isDefault: boolean = false
) {
  await db.insert(brandProfileAccounts).values({
    brandProfileId,
    socialAccountId,
    isDefault,
  }).onConflictDoUpdate({
    target: [brandProfileAccounts.brandProfileId, brandProfileAccounts.socialAccountId],
    set: { isDefault },
  });
}

// Unlink a social account from a brand
async function unlinkAccountFromBrand(
  brandProfileId: string,
  socialAccountId: string
) {
  await db.delete(brandProfileAccounts)
    .where(and(
      eq(brandProfileAccounts.brandProfileId, brandProfileId),
      eq(brandProfileAccounts.socialAccountId, socialAccountId)
    ));
}

// Get default account for a platform
async function getDefaultAccount(
  brandProfileId: string,
  platform: SocialPlatform
) {
  const result = await db
    .select({ account: socialAccounts })
    .from(brandProfileAccounts)
    .innerJoin(socialAccounts, eq(brandProfileAccounts.socialAccountId, socialAccounts.id))
    .where(and(
      eq(brandProfileAccounts.brandProfileId, brandProfileId),
      eq(brandProfileAccounts.isDefault, true),
      eq(socialAccounts.platform, platform),
      isNull(socialAccounts.deletedAt)
    ))
    .limit(1);

  return result[0]?.account;
}
```

### Use Case: Publishing to Shared Account

When publishing, the system selects the account based on the brand's linked accounts:

```typescript
async function getPublishingAccount(
  brandProfileId: string,
  platform: SocialPlatform
) {
  // First try default account for this platform
  const defaultAccount = await getDefaultAccount(brandProfileId, platform);
  if (defaultAccount) return defaultAccount;

  // Fall back to any active account for this platform
  const accounts = await db
    .select({ account: socialAccounts })
    .from(brandProfileAccounts)
    .innerJoin(socialAccounts, eq(brandProfileAccounts.socialAccountId, socialAccounts.id))
    .where(and(
      eq(brandProfileAccounts.brandProfileId, brandProfileId),
      eq(socialAccounts.platform, platform),
      eq(socialAccounts.isActive, true),
      isNull(socialAccounts.deletedAt)
    ))
    .limit(1);

  return accounts[0]?.account;
}
```

---

## Vector Embeddings

### Generating Embeddings

```typescript
import { generateEmbedding } from '@24rabbit/ai';
import { db } from './db';
import { contentEmbeddings } from './schema';
import { createHash } from 'crypto';

async function storeEmbedding(
  organizationId: string,
  contentType: 'MATERIAL' | 'PENDING_POST' | 'POST',
  contentId: string,
  content: string
) {
  // Generate 768-dim embedding
  const embedding = await generateEmbedding(content);

  // Hash for quick dedup check
  const contentHash = createHash('sha256')
    .update(content)
    .digest('hex')
    .slice(0, 16);

  await db.insert(contentEmbeddings).values({
    organizationId,
    contentType,
    contentId,
    embedding,
    contentHash,
  }).onConflictDoUpdate({
    target: [contentEmbeddings.contentType, contentEmbeddings.contentId],
    set: { embedding, contentHash },
  });
}
```

### Similarity Search

```typescript
import { db } from './db';
import { contentEmbeddings } from './schema';
import { sql, eq, and, gt } from 'drizzle-orm';

async function findSimilarContent(
  organizationId: string,
  embedding: number[],
  threshold: number = 0.85,
  limit: number = 5
) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const results = await db.execute(sql`
    SELECT
      id,
      content_type,
      content_id,
      1 - (embedding <=> ${embedding}::vector) as similarity
    FROM content_embeddings
    WHERE organization_id = ${organizationId}
      AND created_at > ${thirtyDaysAgo}
      AND 1 - (embedding <=> ${embedding}::vector) > ${threshold}
    ORDER BY embedding <=> ${embedding}::vector
    LIMIT ${limit}
  `);

  return results;
}
```

### Deduplication Check

```typescript
async function isDuplicate(
  organizationId: string,
  content: string
): Promise<boolean> {
  const embedding = await generateEmbedding(content);
  const similar = await findSimilarContent(organizationId, embedding, 0.85, 1);
  return similar.length > 0;
}
```

### Similarity Thresholds

| Score | Meaning | Action |
|-------|---------|--------|
| 0.0 - 0.5 | Unique | Proceed |
| 0.5 - 0.7 | Different enough | Proceed |
| 0.7 - 0.85 | Similar | Proceed with caution |
| 0.85 - 1.0 | Too similar | Skip, pick another material |

---

## Common Query Patterns

### Dashboard Queries

```typescript
// Get organization overview
async function getOrgDashboard(orgId: string) {
  const [brands, posts, materials, credits] = await Promise.all([
    // Active brand count
    db.select({ count: sql`count(*)` })
      .from(brandProfiles)
      .where(and(
        eq(brandProfiles.organizationId, orgId),
        isNull(brandProfiles.deletedAt)
      )),

    // Posts in last 30 days
    db.select({ count: sql`count(*)` })
      .from(posts)
      .where(and(
        eq(posts.organizationId, orgId),
        gt(posts.publishedAt, thirtyDaysAgo)
      )),

    // Ready materials
    db.select({ count: sql`count(*)` })
      .from(materials)
      .where(and(
        eq(materials.organizationId, orgId),
        eq(materials.status, 'READY'),
        isNull(materials.deletedAt)
      )),

    // Remaining credits
    db.query.subscriptions.findFirst({
      where: eq(subscriptions.organizationId, orgId),
      columns: { creditsTotal: true, creditsUsed: true },
    }),
  ]);

  return {
    brandCount: brands[0].count,
    recentPosts: posts[0].count,
    readyMaterials: materials[0].count,
    creditsRemaining: (credits?.creditsTotal ?? 0) - (credits?.creditsUsed ?? 0),
  };
}
```

### Scheduling Queries

```typescript
// Get schedules ready to run
async function getReadySchedules() {
  return db.query.schedules.findMany({
    where: and(
      eq(schedules.isActive, true),
      lte(schedules.nextRunAt, new Date())
    ),
    with: {
      brandProfile: true,
    },
  });
}

// Update next run time
async function updateScheduleNextRun(scheduleId: string, nextRunAt: Date) {
  await db.update(schedules)
    .set({ nextRunAt })
    .where(eq(schedules.id, scheduleId));
}
```

### Material Selection

```typescript
// Round-robin material selection
async function selectNextMaterial(brandProfileId: string) {
  return db.query.materials.findFirst({
    where: and(
      eq(materials.brandProfileId, brandProfileId),
      eq(materials.status, 'READY'),
      isNull(materials.deletedAt)
    ),
    orderBy: [
      asc(materials.usageCount),
      asc(materials.lastUsedAt),
    ],
  });
}

// Pillar-balanced selection
async function selectMaterialByPillar(
  brandProfileId: string,
  targetPillar: string
) {
  return db.query.materials.findFirst({
    where: and(
      eq(materials.brandProfileId, brandProfileId),
      eq(materials.status, 'READY'),
      eq(materials.contentPillar, targetPillar),
      isNull(materials.deletedAt)
    ),
    orderBy: asc(materials.lastUsedAt),
  });
}
```

### Analytics Queries

```typescript
// Angle performance analysis
async function getAnglePerformance(brandProfileId: string) {
  return db.execute(sql`
    SELECT
      angle,
      AVG(likes + comments + shares) as avg_engagement,
      AVG(engagement_rate) as avg_engagement_rate,
      COUNT(*) as post_count
    FROM posts
    WHERE brand_profile_id = ${brandProfileId}
      AND published_at > NOW() - INTERVAL '30 days'
      AND deleted_at IS NULL
    GROUP BY angle
    ORDER BY avg_engagement DESC
  `);
}

// Platform performance comparison
async function getPlatformPerformance(organizationId: string) {
  return db.execute(sql`
    SELECT
      platform,
      COUNT(*) as post_count,
      SUM(likes) as total_likes,
      SUM(comments) as total_comments,
      SUM(shares) as total_shares,
      AVG(engagement_rate) as avg_engagement_rate
    FROM posts
    WHERE organization_id = ${organizationId}
      AND published_at > NOW() - INTERVAL '30 days'
      AND deleted_at IS NULL
    GROUP BY platform
    ORDER BY avg_engagement_rate DESC
  `);
}
```

---

## Token Encryption

OAuth tokens are encrypted at rest using AES-256.

```typescript
// packages/shared/src/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### Usage in SocialAccount

```typescript
// Storing encrypted token
await db.insert(socialAccounts).values({
  // ... other fields
  accessToken: encrypt(rawAccessToken),
  refreshToken: refreshToken ? encrypt(refreshToken) : null,
});

// Reading and decrypting token
const account = await db.query.socialAccounts.findFirst({
  where: eq(socialAccounts.id, accountId),
});

const accessToken = decrypt(account.accessToken);
```

---

## Transaction Patterns

### Credit Deduction

```typescript
import { db } from './db';
import { subscriptions, creditTransactions } from './schema';
import { eq, sql } from 'drizzle-orm';

async function deductCredits(
  organizationId: string,
  amount: number,
  action: CreditAction,
  relatedPostId?: string
) {
  await db.transaction(async (tx) => {
    // Check and update credits atomically
    const result = await tx.update(subscriptions)
      .set({
        creditsUsed: sql`credits_used + ${amount}`,
      })
      .where(and(
        eq(subscriptions.organizationId, organizationId),
        sql`credits_used + ${amount} <= credits_total`
      ))
      .returning();

    if (result.length === 0) {
      throw new Error('Insufficient credits');
    }

    // Log transaction
    await tx.insert(creditTransactions).values({
      organizationId,
      subscriptionId: result[0].id,
      amount: -amount, // Negative for debit
      action,
      relatedPostId,
      description: `Credit deduction for ${action}`,
    });
  });
}
```

### Post Publication

```typescript
async function publishPost(pendingPostId: string) {
  return db.transaction(async (tx) => {
    // Get pending post
    const pending = await tx.query.pendingPosts.findFirst({
      where: eq(pendingPosts.id, pendingPostId),
    });

    if (!pending) throw new Error('Pending post not found');

    // Create published post
    const [post] = await tx.insert(posts).values({
      organizationId: pending.organizationId,
      brandProfileId: pending.brandProfileId,
      materialId: pending.materialId,
      scheduleId: pending.scheduleId,
      content: pending.content,
      hashtags: pending.hashtags,
      mediaUrls: pending.mediaUrls,
      platform: pending.platforms[0], // For single platform
      angle: pending.angle,
      angleReason: pending.angleReason,
      publishedAt: new Date(),
    }).returning();

    // Update pending post status
    await tx.update(pendingPosts)
      .set({ status: 'PUBLISHED' })
      .where(eq(pendingPosts.id, pendingPostId));

    // Update material usage
    await tx.update(materials)
      .set({
        usageCount: sql`usage_count + 1`,
        lastUsedAt: new Date(),
        status: 'USED',
      })
      .where(eq(materials.id, pending.materialId));

    return post;
  });
}
```

---

*Related: [Schema](./03-schema.md) | [Indexes](./05-indexes.md)*
