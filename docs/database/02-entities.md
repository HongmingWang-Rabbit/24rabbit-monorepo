# Database Entities

## Entity Hierarchy

```
Organization (billing unit, team)
├── Subscription (1:1) - Stripe, credits
├── CreditTransaction (1:N) - Usage history
├── OrganizationMember (1:N) - Users with roles
│   └── User (N:1) - Auth, profile
├── SocialAccount (1:N) - Connected platform accounts
│   └── BrandProfileAccount (N:M join) - Links accounts to brands
├── BrandProfile (1:N) - Brand configurations
│   ├── BrandProfileAccount (N:M join) - Links brands to accounts
│   ├── Schedule (1:N) - Autopilot schedules
│   ├── Material (1:N) - Uploaded content
│   └── ExternalSource (1:N) - Shopify, etc.
├── Post (1:N) - Published content
├── PendingPost (1:N) - Awaiting approval/publish
└── ContentEmbedding (1:N) - Vector deduplication
```

**N:M Relationship:** One social account can be used by multiple brands, and one brand can use multiple accounts.

## Core Entities

### User

Authentication and profile. Managed by Better Auth.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Primary key (cuid2) |
| email | text | Unique email address |
| emailVerified | boolean | Email verification status |
| name | text | Display name |
| image | text | Avatar URL |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update time |

**Relationships:**
- Can belong to multiple Organizations (N:M via OrganizationMember)

---

### Organization

Billing unit and data boundary. All content belongs to an Organization.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Primary key (cuid2) |
| name | text | Organization name |
| slug | text | URL-friendly identifier (unique) |
| logo | text | Logo URL (R2) |
| stripeCustomerId | text | Stripe customer reference |
| deletedAt | timestamp | Soft delete marker |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update time |

**Relationships:**
- Has one Subscription (1:1)
- Has many OrganizationMembers (1:N)
- Has many SocialAccounts (1:N)
- Has many BrandProfiles (1:N)
- Has many Posts, PendingPosts, Materials (1:N)

---

### OrganizationMember

Join table for User ↔ Organization (N:M with role).

| Field | Type | Description |
|-------|------|-------------|
| id | text | Primary key (cuid2) |
| organizationId | text | FK → Organization |
| userId | text | FK → User |
| role | enum | OWNER, ADMIN, MEMBER, VIEWER |
| invitedAt | timestamp | When invitation was sent |
| joinedAt | timestamp | When user accepted |
| createdAt | timestamp | Creation time |

**Role Permissions:**

| Role | Manage Members | Manage Billing | Manage Brands | View Analytics | Create Content |
|------|---------------|----------------|---------------|----------------|----------------|
| OWNER | ✓ | ✓ | ✓ | ✓ | ✓ |
| ADMIN | ✓ | | ✓ | ✓ | ✓ |
| MEMBER | | | ✓ | ✓ | ✓ |
| VIEWER | | | | ✓ | |

---

### Subscription

Billing and credit tracking at Organization level.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Primary key (cuid2) |
| organizationId | text | FK → Organization (unique) |
| tier | enum | FREE, STARTER, GROWTH, BUSINESS, ENTERPRISE |
| status | enum | ACTIVE, CANCELLED, PAST_DUE, TRIALING, PAUSED |
| creditsTotal | integer | Total credits for current period |
| creditsUsed | integer | Credits consumed |
| currentPeriodStart | timestamp | Billing period start |
| currentPeriodEnd | timestamp | Billing period end |
| stripeSubscriptionId | text | Stripe subscription reference |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update time |

---

### CreditTransaction

Granular credit usage tracking.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Primary key (cuid2) |
| organizationId | text | FK → Organization |
| subscriptionId | text | FK → Subscription |
| amount | integer | Positive = credit, Negative = debit |
| action | enum | GENERATE, PUBLISH, ANALYTICS, TOPUP, etc. |
| description | text | Human-readable description |
| relatedPostId | text | FK → Post (if applicable) |
| createdAt | timestamp | Transaction time |

---

### BrandProfile

Brand configuration and voice settings.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Primary key (cuid2) |
| organizationId | text | FK → Organization |
| name | text | Brand name |
| logo | text | Brand logo URL |
| icon | text | Brand icon URL |
| colors | jsonb | BrandColors object |
| visualStyle | enum | MINIMAL, BOLD, PLAYFUL, CORPORATE, LUXURY, TECH |
| fontPreference | enum | MODERN, CLASSIC, HANDWRITTEN, MONOSPACE |
| tone | text[] | Tone keywords ["witty", "confident"] |
| personality | text | Brand personality description |
| languageRules | jsonb | LanguageRules object |
| examplePosts | jsonb | ExamplePost[] array |
| customContext | text | Free-form instructions |
| targetAudience | text | Target audience description |
| contentPillars | jsonb | ContentPillar[] array |
| platformSettings | jsonb | Per-platform overrides |
| autoApprove | boolean | Skip manual review (default: true) |
| deletedAt | timestamp | Soft delete marker |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update time |

**Relationships:**
- Has many SocialAccounts (N:M via BrandProfileAccount)
- Has many Schedules (1:N)
- Has many Materials (1:N)
- Has many ExternalSources (1:N)

---

### SocialAccount

Connected social media platform account. Belongs to Organization, linked to BrandProfiles via N:M join table.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Primary key (cuid2) |
| organizationId | text | FK → Organization |
| platform | enum | FACEBOOK, TWITTER, LINKEDIN, etc. |
| accountId | text | Platform's user/page ID |
| accountName | text | Display name |
| accountType | text | personal, page, business |
| profileUrl | text | Link to profile |
| avatarUrl | text | Profile picture URL |
| accessToken | text | OAuth access token (encrypted) |
| refreshToken | text | OAuth refresh token (encrypted) |
| tokenExpiresAt | timestamp | Token expiration time |
| isActive | boolean | Account active status |
| deletedAt | timestamp | Soft delete marker |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update time |

**Unique constraint:** `(platform, accountId)` - same account can't be connected twice

**Relationships:**
- Belongs to Organization (N:1)
- Has many BrandProfiles (N:M via BrandProfileAccount)

---

### BrandProfileAccount

Join table for BrandProfile ↔ SocialAccount (N:M).

| Field | Type | Description |
|-------|------|-------------|
| id | text | Primary key (cuid2) |
| brandProfileId | text | FK → BrandProfile |
| socialAccountId | text | FK → SocialAccount |
| isDefault | boolean | Default account for this platform per brand |
| createdAt | timestamp | Creation time |

**Unique constraint:** `(brandProfileId, socialAccountId)` - same link can't exist twice

**Use case example:**
```
Brand "Personal"  ──┬──► @my_twitter
                    └──► @my_instagram

Brand "Company"   ──┬──► @my_twitter      (shared!)
                    └──► @company_linkedin
```

---

### Schedule

Autopilot scheduling configuration.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Primary key (cuid2) |
| brandProfileId | text | FK → BrandProfile |
| name | text | Schedule name |
| platforms | enum[] | Target platforms |
| frequency | text | 1_per_day, 2_per_day, custom |
| times | text[] | Times in HH:MM format |
| timezone | text | IANA timezone (e.g., "America/Vancouver") |
| daysOfWeek | integer[] | 0=Sun, 1=Mon, etc. |
| materialStrategy | text | round_robin, random, weighted, pillar_balanced |
| autoApprove | boolean | Skip manual review |
| uniquePerPlatform | boolean | Generate unique content per platform |
| isActive | boolean | Schedule active status |
| nextRunAt | timestamp | Next scheduled execution |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update time |

---

### Material

User-uploaded content for post generation.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Primary key (cuid2) |
| organizationId | text | FK → Organization |
| brandProfileId | text | FK → BrandProfile (nullable) |
| type | enum | TEXT, URL, FILE, IMAGE, VIDEO |
| name | text | User-provided name |
| originalContent | text | Raw text content |
| fileKey | text | R2 storage path |
| fileSize | integer | File size in bytes |
| mimeType | text | File MIME type |
| url | text | Source URL (for URL type) |
| summary | text | AI-generated summary |
| keyPoints | text[] | Extracted key points |
| keywords | text[] | Extracted keywords |
| suggestedAngles | enum[] | AI-suggested content angles |
| sentiment | text | positive, neutral, negative |
| contentPillar | text | Detected pillar category |
| status | enum | UPLOADED, PROCESSING, ANALYZED, READY, USED, ARCHIVED, FAILED |
| usageCount | integer | Times used in posts |
| lastUsedAt | timestamp | Last usage time |
| embeddingId | text | FK → ContentEmbedding |
| deletedAt | timestamp | Soft delete marker |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update time |

---

### ExternalSource

Connected e-commerce platforms.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Primary key (cuid2) |
| organizationId | text | FK → Organization |
| brandProfileId | text | FK → BrandProfile |
| type | text | shopify, woocommerce, custom |
| name | text | Source name |
| storeUrl | text | Store URL |
| connectionConfig | jsonb | Encrypted connection credentials |
| lastCrawlAt | timestamp | Last product sync time |
| crawlFrequency | text | Cron expression |
| isActive | boolean | Source active status |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update time |

---

### PendingPost

Content awaiting approval or scheduled publish.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Primary key (cuid2) |
| organizationId | text | FK → Organization |
| brandProfileId | text | FK → BrandProfile |
| materialId | text | FK → Material |
| scheduleId | text | FK → Schedule (nullable) |
| platforms | enum[] | Target platforms |
| content | text | Generated content |
| hashtags | text[] | Generated hashtags |
| mediaUrls | text[] | Media file URLs |
| angle | enum | AI-selected content angle |
| angleReason | text | Why AI chose this angle |
| generationMode | text | autopilot, manual |
| scheduledFor | timestamp | When to publish |
| expiresAt | timestamp | Approval timeout |
| status | enum | PENDING, AUTO_APPROVED, PUBLISHED, FAILED |
| embeddingId | text | FK → ContentEmbedding |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update time |

---

### Post

Published content with metrics.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Primary key (cuid2) |
| organizationId | text | FK → Organization |
| brandProfileId | text | FK → BrandProfile |
| socialAccountId | text | FK → SocialAccount |
| materialId | text | FK → Material (nullable) |
| scheduleId | text | FK → Schedule (nullable) |
| content | text | Published content |
| hashtags | text[] | Used hashtags |
| mediaUrls | text[] | Media file URLs |
| platform | enum | Target platform |
| externalId | text | Platform's post ID |
| externalUrl | text | Link to published post |
| publishedAt | timestamp | Publication time |
| angle | enum | Content angle used |
| angleReason | text | Why AI chose this angle |
| isExploration | boolean | A/B testing flag |
| likes | integer | Like count |
| comments | integer | Comment count |
| shares | integer | Share count |
| impressions | integer | View count |
| reach | integer | Unique viewers |
| clicks | integer | Link clicks |
| engagementRate | real | Calculated engagement rate |
| metricsUpdatedAt | timestamp | Last metrics update |
| deletedAt | timestamp | Soft delete marker |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update time |

---

### ContentEmbedding

Vector embeddings for content deduplication.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Primary key (cuid2) |
| organizationId | text | FK → Organization |
| contentType | enum | MATERIAL, PENDING_POST, POST |
| contentId | text | Polymorphic FK |
| embedding | vector(768) | 768-dimensional vector |
| contentHash | text | Quick dedup check hash |
| createdAt | timestamp | Creation time |

**Unique constraint:** `(contentType, contentId)`

---

## Status Enums

### MaterialStatus

| Status | Description |
|--------|-------------|
| UPLOADED | Just uploaded, pending processing |
| PROCESSING | Being analyzed by AI |
| ANALYZED | Analysis complete, pending embedding |
| READY | Ready for content generation |
| USED | Used in at least one post |
| ARCHIVED | User archived, won't be selected |
| FAILED | Processing failed |

### PendingPostStatus

| Status | Description |
|--------|-------------|
| PENDING | Waiting for approval (if required) |
| AUTO_APPROVED | Auto-approved, ready to publish |
| PUBLISHED | Successfully published |
| FAILED | Publishing failed after retries |

---

*Related: [Schema](./03-schema.md) | [Types](./04-types.md)*
