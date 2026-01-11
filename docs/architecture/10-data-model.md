# Data Model

## Core Entities

### User

```typescript
User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  createdAt: Date
  updatedAt: Date
}
```

### Subscription

```typescript
Subscription {
  id: string
  userId: string
  tier: 'starter' | 'growth' | 'business'
  status: 'active' | 'cancelled' | 'past_due' | 'trialing'
  creditsTotal: number          // Total credits for current period
  creditsUsed: number           // Credits consumed
  currentPeriodStart: Date      // Month start
  currentPeriodEnd: Date        // Month end
  stripeSubscriptionId: string  // Stripe reference
  stripeCustomerId: string
  createdAt: Date
  updatedAt: Date
}
```

### CreditTransaction

```typescript
CreditTransaction {
  id: string
  userId: string
  subscriptionId: string
  amount: number                // Positive = credit, Negative = debit
  action: 'generate' | 'generate_trending' | 'rewrite' | 'publish' | 'analytics' | 'topup' | 'subscription'
  description: string
  relatedPostId?: string
  createdAt: Date
}
```

### SocialAccount

```typescript
SocialAccount {
  id: string
  userId: string
  platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram' | 'youtube' | 'reddit'
  accountId: string             // Platform-specific ID
  accountName: string           // Display name
  accountType: 'personal' | 'page' | 'business'
  accessToken: string           // Encrypted
  refreshToken?: string         // Encrypted
  tokenExpiresAt?: Date
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
```

### BrandProfile

```typescript
BrandProfile {
  id: string
  userId: string
  name: string                  // Brand name
  tagline: string
  industry: string
  targetAudience: string[]
  tone: string                  // Content tone/voice
  topics: string[]              // Core topics
  sellingPoints: string[]
  forbiddenWords: string[]
  language: string              // Primary language
  website?: string

  // Publishing Settings
  requireApproval: boolean
  notifyEmail?: string
  notifyWebhook?: string
  approvalTimeout: number       // Hours

  // Trending Settings
  trendingEnabled: boolean
  trendingFilters?: {
    industries: string[]
    excludeTopics: string[]
    minRelevance: number
  }

  // Platform-specific instructions
  platformInstructions: {
    [platform: string]: string
  }

  createdAt: Date
  updatedAt: Date
}
```

### Schedule

```typescript
Schedule {
  id: string
  brandProfileId: string
  cronExpression: string        // e.g., "0 9 * * *"
  timezone: string              // e.g., "America/Vancouver"
  isActive: boolean
  platforms: string[]           // Target platforms
  contentSource: 'auto' | 'material_only' | 'trending_only'
  lastRunAt?: Date
  nextRunAt: Date
  createdAt: Date
  updatedAt: Date
}
```

### Material

```typescript
Material {
  id: string
  userId: string
  brandProfileId: string
  type: 'video' | 'image' | 'text'
  originalUrl: string           // S3/storage URL
  processedAssets: {
    thumbnails?: string[]
    platformSizes?: { [size: string]: string }
  }
  metadata: {
    duration?: number           // Video duration
    dimensions?: { width: number, height: number }
    analysis?: string           // AI analysis result
  }
  tags: string[]
  status: 'unused' | 'used_once' | 'used_multiple'
  usedCount: number
  createdAt: Date
  updatedAt: Date
}
```

### ExternalSource

```typescript
ExternalSource {
  id: string
  userId: string
  brandProfileId: string
  type: 'shopify' | 'woocommerce' | 'custom'
  name: string
  connectionConfig: {           // Encrypted
    apiKey?: string
    apiSecret?: string
    storeUrl?: string
  }
  lastCrawlAt?: Date
  crawlFrequency: string        // Cron expression
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
```

### Post

```typescript
Post {
  id: string
  userId: string
  brandProfileId: string
  scheduleId?: string
  materialId?: string

  // Content
  content: string
  mediaUrls: string[]
  contentType: 'text' | 'image' | 'video' | 'carousel'
  sourceType: 'ai_generated' | 'trending' | 'rewrite' | 'manual'

  // Publishing
  platform: string
  platformPostId?: string       // ID returned by platform
  status: 'pending_approval' | 'scheduled' | 'publishing' | 'published' | 'failed'
  scheduledAt?: Date
  publishedAt?: Date
  failureReason?: string

  // Analytics
  metrics?: {
    likes: number
    comments: number
    shares: number
    impressions: number
    clicks: number
    fetchedAt: Date
  }

  // Credit tracking
  creditsUsed: number

  createdAt: Date
  updatedAt: Date
}
```

### PendingPost

```typescript
PendingPost {
  id: string
  brandProfileId: string
  generatedContent: string
  suggestedMediaUrls?: string[]
  sourceType: 'ai_generated' | 'trending' | 'rewrite'
  sourceMaterial?: string       // Original material if rewrite
  trendingTopic?: string        // Topic if trending-based
  targetPlatforms: string[]
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  expiresAt: Date               // 24-hour expiry
  reviewedAt?: Date
  reviewNote?: string
  createdAt: Date
}
```

### ContentEmbedding

```typescript
ContentEmbedding {
  id: string
  userId: string
  postId: string
  platform: string
  embedding: vector(768)        // pgvector
  contentHash: string           // Quick comparison
  createdAt: Date
}
```

## Database Schema Notes

### PostgreSQL with pgvector

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Content embeddings table
CREATE TABLE content_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  post_id UUID REFERENCES posts(id),
  platform VARCHAR(50),
  embedding vector(768),
  content_hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for similarity search
CREATE INDEX ON content_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### Encryption

- All OAuth tokens encrypted at rest (AES-256)
- Use environment variable for encryption key
- Never log sensitive tokens

### Indexes

```sql
-- User queries
CREATE INDEX idx_social_accounts_user ON social_accounts(user_id);
CREATE INDEX idx_brand_profiles_user ON brand_profiles(user_id);
CREATE INDEX idx_posts_user ON posts(user_id);

-- Status queries
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_pending_posts_status ON pending_posts(status);
CREATE INDEX idx_materials_status ON materials(status);

-- Time-based queries
CREATE INDEX idx_posts_published_at ON posts(published_at);
CREATE INDEX idx_schedules_next_run ON schedules(next_run_at);
```

### Soft Delete

```typescript
// All user-facing tables include
{
  deletedAt?: Date  // null = active, date = soft deleted
}
```

## Entity Relationships

```
User
 ├── Subscription (1:1)
 ├── CreditTransaction (1:N)
 ├── SocialAccount (1:N)
 ├── BrandProfile (1:N)
 │    ├── Schedule (1:N)
 │    ├── Material (1:N)
 │    ├── ExternalSource (1:N)
 │    ├── Post (1:N)
 │    └── PendingPost (1:N)
 └── ContentEmbedding (1:N)
```

---

*Related: [MVP Scope](./11-mvp-scope.md) | [Security](./13-security.md)*
