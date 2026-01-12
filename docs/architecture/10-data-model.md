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
  platform: 'FACEBOOK' | 'TWITTER' | 'LINKEDIN' | 'INSTAGRAM' | 'YOUTUBE' | 'REDDIT' | 'THREADS'
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

  // Identity (Visual)
  name: string
  logo?: string                 // R2 URL
  icon?: string                 // R2 URL
  colors: {
    primary: string             // "#6366F1"
    secondary: string           // "#EC4899"
    accent: string              // "#10B981"
    background: string          // "#FFFFFF"
    text: string                // "#1F2937"
  }
  visualStyle: 'minimal' | 'bold' | 'playful' | 'corporate' | 'luxury' | 'tech'
  fontPreference: 'modern' | 'classic' | 'handwritten' | 'monospace'

  // Voice (Tone & Language)
  tone: string[]                // ["witty", "confident", "friendly"]
  personality: string           // "A smart friend who simplifies tech"
  languageRules: {
    wordsToUse: string[]        // ["ship", "build", "craft"]
    wordsToAvoid: string[]      // ["synergy", "leverage"]
    emojiUsage: 'none' | 'minimal' | 'moderate' | 'heavy'
    hashtagStyle: 'none' | 'minimal' | 'moderate' | 'heavy'
    ctaStyle: 'none' | 'soft' | 'direct'
  }
  examplePosts: Array<{
    platform: Platform
    content: string
  }>

  // Context (Custom Instructions)
  customContext: string         // Free-form user instructions
  targetAudience: string        // "HR managers at mid-size companies"
  contentPillars: Array<{
    name: string                // "Product Updates"
    percentage: number          // 40
  }>

  // Platform Settings (per-platform overrides)
  platformSettings: {
    [platform: Platform]: {
      enabled: boolean
      toneOverride?: string[]
      customContextOverride?: string
      hashtagsDefault?: string[]
    }
  }

  // Publishing Settings
  requireApproval: boolean
  notifyEmail?: string
  notifyWebhook?: string
  approvalTimeout: number       // Hours (default: 24)

  // Trending Settings
  trendingEnabled: boolean
  trendingFilters?: {
    industries: string[]
    excludeTopics: string[]
    minRelevance: number
  }

  createdAt: Date
  updatedAt: Date
}

type Platform = 'TWITTER' | 'LINKEDIN' | 'FACEBOOK' | 'INSTAGRAM' | 'THREADS'
```

### Schedule

```typescript
Schedule {
  id: string
  brandProfileId: string        // FK → BrandProfile
  platforms: Platform[]         // ["TWITTER", "LINKEDIN"]
  frequency: '1_per_day' | '2_per_day' | '3_per_day' | 'weekly' | 'custom'
  times: string[]               // ["09:00", "17:00"]
  timezone: string              // "America/Vancouver"
  daysOfWeek: number[]          // [1,2,3,4,5] (Mon-Fri, 0=Sun)
  materialStrategy: 'round_robin' | 'random' | 'weighted' | 'pillar_balanced'
  autoApprove: boolean          // Skip manual review
  uniquePerPlatform: boolean    // Generate unique content per platform
  isActive: boolean
  nextRunAt: Date
  createdAt: Date
  updatedAt: Date
}
```

### Material

```typescript
Material {
  id: string
  userId: string                // FK → User
  brandProfileId?: string       // FK → BrandProfile (optional)

  // Source
  type: 'TEXT' | 'URL' | 'FILE' | 'IMAGE' | 'VIDEO'
  originalContent: string       // Raw text content
  fileKey?: string              // R2 path, if file
  url?: string                  // If URL type

  // AI Analysis Results
  summary: string               // AI-generated summary
  keyPoints: string[]           // Extracted key points
  keywords: string[]            // Extracted keywords
  suggestedAngles: string[]     // AI-suggested content angles
  contentType?: string          // Detected content type
  sentiment?: string            // Detected sentiment

  // Status & Usage
  status: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'READY' | 'USED' | 'ARCHIVED'
  usageCount: number            // How many times used
  lastUsedAt?: Date             // Last usage timestamp

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

### PendingPost

```typescript
PendingPost {
  id: string
  userId: string                // FK → User
  brandProfileId: string        // FK → BrandProfile
  materialId: string            // FK → Material
  platform: Platform

  // Generated Variations (3)
  variations: Array<{
    content: string
    angle: string               // "product focus" | "user benefit" | "storytelling"
    hashtags: string[]
    characterCount: number
  }>
  selectedVariation: number     // 0, 1, or 2
  finalContent: string          // After user edits (if any)

  // Scheduling
  scheduledFor: Date
  generationMode: 'autopilot' | 'manual'

  // Status
  status: 'DRAFT' | 'PENDING' | 'AUTO_APPROVED' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'FAILED'
  reviewNotes?: string          // User's notes when rejecting

  // Embedding for similarity
  embedding: vector(768)

  createdAt: Date
  updatedAt: Date
}
```

### Post

```typescript
Post {
  id: string
  userId: string                // FK → User
  socialAccountId: string       // FK → SocialAccount
  pendingPostId: string         // FK → PendingPost
  materialId?: string           // FK → Material
  platform: Platform

  // Content
  content: string
  mediaUrls: string[]           // R2 URLs

  // Platform Reference
  externalId: string            // Platform's post ID
  publishedAt: Date

  // Metrics (updated hourly)
  likes: number
  comments: number
  shares: number
  impressions: number
  reach: number
  clicks: number

  // Embedding for similarity
  embedding: vector(768)

  createdAt: Date
  updatedAt: Date
}
```

### ContentEmbedding

```typescript
ContentEmbedding {
  id: string
  userId: string                // FK → User
  contentType: 'material' | 'pending_post' | 'post'
  contentId: string             // Polymorphic FK
  embedding: vector(768)        // pgvector
  contentHash: string           // For quick dedup check
  createdAt: Date
  updatedAt: Date
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
  content_type VARCHAR(50),
  content_id UUID,
  embedding vector(768),
  content_hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for similarity search (cosine distance)
CREATE INDEX ON content_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### Similarity Query Example

```sql
-- Find similar content within last 30 days
SELECT *
FROM content_embeddings
WHERE user_id = $1
AND created_at > NOW() - INTERVAL '30 days'
ORDER BY embedding <=> $2  -- cosine distance
LIMIT 5;
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
CREATE INDEX idx_materials_user ON materials(user_id);

-- Status queries
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_pending_posts_status ON pending_posts(status);
CREATE INDEX idx_materials_status ON materials(status);

-- Time-based queries
CREATE INDEX idx_posts_published_at ON posts(published_at);
CREATE INDEX idx_schedules_next_run ON schedules(next_run_at);
CREATE INDEX idx_materials_last_used ON materials(last_used_at);

-- Composite indexes
CREATE INDEX idx_pending_posts_user_status ON pending_posts(user_id, status);
CREATE INDEX idx_materials_user_status ON materials(user_id, status);
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
 │    └── PendingPost (1:N)
 ├── Material (1:N) - user can have materials without brand
 ├── Post (1:N)
 └── ContentEmbedding (1:N)

PendingPost
 ├── BrandProfile (N:1)
 ├── Material (N:1)
 └── Post (1:1) - when published

Post
 ├── User (N:1)
 ├── SocialAccount (N:1)
 ├── PendingPost (1:1)
 └── Material (N:1)
```

## Status Enums

### Material Status

| Status | Description |
|--------|-------------|
| `UPLOADED` | Just uploaded, pending processing |
| `PROCESSING` | Being analyzed by AI |
| `ANALYZED` | Analysis complete, pending embedding |
| `READY` | Ready for content generation |
| `USED` | Used in at least one post |
| `ARCHIVED` | User archived, won't be selected |

### PendingPost Status

| Status | Description |
|--------|-------------|
| `DRAFT` | Initial creation, not complete |
| `PENDING` | Waiting for user review/action |
| `AUTO_APPROVED` | Auto-approved via autopilot |
| `APPROVED` | User approved, ready to publish |
| `REJECTED` | User rejected |
| `PUBLISHED` | Successfully published |
| `FAILED` | Publishing failed after retries |

### Platform Enum

```typescript
type Platform = 'TWITTER' | 'LINKEDIN' | 'FACEBOOK' | 'INSTAGRAM' | 'YOUTUBE' | 'REDDIT' | 'THREADS'
```

---

*Related: [MVP Scope](./11-mvp-scope.md) | [Security](./13-security.md)*
