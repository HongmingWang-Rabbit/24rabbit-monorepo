# Database Architecture Overview

## Core Philosophy

24Rabbit is an **autonomous marketing agent** that runs 24/7 with minimal user intervention. The database is designed around this principle:

- Users configure their brand once
- The agent automatically selects materials, generates content, and publishes
- Manual review is optional, not default

## Why Drizzle over Prisma

| Factor | Drizzle | Prisma |
|--------|---------|--------|
| **pgvector** | Native support | Workaround needed |
| **Bundle size** | ~50KB | ~2MB |
| **Edge runtime** | Full support | Limited |
| **SQL flexibility** | SQL-like syntax | Abstracted |
| **Query performance** | Faster, less overhead | More abstraction layers |

Drizzle provides native pgvector support without workarounds, making it ideal for our content deduplication use case.

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Organization layer** | Yes | Agencies, teams, multi-user collaboration. Subscription at org level. |
| **Complex configs** | JSON fields | `colors`, `languageRules`, `platformSettings` - always read/written as units |
| **Content generation** | Single output | One post per generation, `angle` is metadata for analytics (not user choice) |
| **Angle selection** | AI-driven | AI picks angle based on material + A/B history, with occasional exploration |
| **Embeddings** | Polymorphic table | Single `ContentEmbedding` table with `contentType` + `contentId` |
| **Org scoping** | Denormalized `orgId` | Copied to all content tables for fast queries |
| **Soft delete** | `deletedAt` field | On User, Organization, SocialAccount, BrandProfile, Material, Post |
| **Brand-Account** | N:M | One account can be used by multiple brands (via `BrandProfileAccount` join table) |
| **Credit tracking** | Granular | Every transaction logged for debugging, refunds, analytics |

## Data Ownership Model

```
┌─────────────────────────────────────────────────────────────┐
│                      ORGANIZATION                           │
│  (billing unit, team, data boundary)                        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Subscription│  │   Members   │  │   Credits   │        │
│  │   (1:1)     │  │   (1:N)     │  │   (1:N)     │        │
│  └─────────────┘  └──────┬──────┘  └─────────────┘        │
│                          │                                  │
│                    ┌─────▼─────┐                           │
│                    │   Users   │                           │
│                    │  (N:M)    │                           │
│                    └───────────┘                           │
│                                                             │
│  ┌───────────────────┐      ┌───────────────────────────┐  │
│  │  SOCIAL ACCOUNTS  │      │      BRAND PROFILES       │  │
│  │  (1:N from Org)   │◄────►│      (1:N from Org)       │  │
│  │                   │ N:M  │                           │  │
│  │  @my_twitter      │      │  "Personal Brand"         │  │
│  │  @company_linkedin│      │  "Company Brand"          │  │
│  │  @my_instagram    │      │                           │  │
│  └───────────────────┘      │  ┌─────────┐ ┌─────────┐  │  │
│                             │  │Schedules│ │Materials│  │  │
│                             │  └─────────┘ └─────────┘  │  │
│                             └───────────────────────────┘  │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    Posts    │  │ PendingPost │  │ Embeddings  │        │
│  │   (1:N)     │  │   (1:N)     │  │   (1:N)     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**N:M Relationship Example:**
```
SocialAccount "@my_twitter" ◄───► BrandProfile "Personal Brand"
                           ◄───► BrandProfile "Company Brand"

Both brands can post to the same Twitter account.
```

## Autonomous Agent Defaults

The database defaults reflect the autonomous nature of 24Rabbit:

```typescript
// BrandProfile
autoApprove: boolean('auto_approve').default(true)  // No manual review needed

// Schedule
autoApprove: boolean('auto_approve').default(true)  // Publish automatically
isActive: boolean('is_active').default(true)        // Active by default

// PendingPost status flow
'PENDING' → 'AUTO_APPROVED' → 'PUBLISHED'  // Typical flow
'PENDING' → 'APPROVED' → 'PUBLISHED'       // Manual review flow (optional)
```

## Content Angle System

The `angle` field is **analytics metadata**, not a user choice. The AI selects the angle based on:

1. **Material analysis** - What angles does this material support?
2. **A/B history** - Which angles perform best for this brand?
3. **Exploration** - Occasionally test underperforming angles

```typescript
// ContentAngle enum
'PRODUCT_FOCUS'   // Features, specs, what it is
'USER_BENEFIT'    // How it helps the user
'STORYTELLING'    // Narrative, emotional connection
'EDUCATIONAL'     // Tips, how-to, industry insights
'SOCIAL_PROOF'    // Testimonials, case studies
'PROMOTIONAL'     // Sales, discounts, urgency
```

### Learning Loop

```
[Post published with angle tag]
        │
        ▼
[Collect metrics hourly]
        │
        ▼
[Aggregate angle performance per brand]
        │
        ▼
[AI uses data to pick better angles]
        │
        ▼
[Occasional exploration (isExploration=true)]
```

## Scale Considerations

Designed for **medium scale** (1K-10K organizations):

- Denormalized `organizationId` on all tables for fast filtering
- Partial indexes for common query patterns
- IVFFlat index for vector similarity (scales to millions of embeddings)
- No sharding needed at this scale

## Security Considerations

| Data | Protection |
|------|------------|
| OAuth tokens | AES-256 encryption at rest |
| External source configs | Encrypted JSON field |
| User passwords | Handled by Better Auth (bcrypt) |
| API keys | Never stored in database |

---

*Related: [Entities](./02-entities.md) | [Schema](./03-schema.md)*
