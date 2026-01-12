# Database Documentation

> PostgreSQL database architecture for 24Rabbit with Drizzle ORM and pgvector

## Quick Links

| Document | Description |
|----------|-------------|
| [Overview](./01-overview.md) | Architecture, ORM choice, design decisions |
| [Entities](./02-entities.md) | Entity hierarchy and relationships |
| [Schema](./03-schema.md) | Detailed Drizzle schema definitions |
| [Types](./04-types.md) | TypeScript types for JSON fields |
| [Indexes](./05-indexes.md) | Index strategy for medium scale |
| [Patterns](./06-patterns.md) | Soft delete, embeddings, common queries |

## Entity Overview

```
Organization (billing unit, team)
├── Subscription (1:1) - Stripe, credits
├── CreditTransaction (1:N) - Usage history
├── OrganizationMember (1:N) - Users with roles
│   └── User (N:1) - Auth, profile
├── SocialAccount (1:N) - Connected platform accounts
│   └── BrandProfileAccount (N:M) - Links to brands
├── BrandProfile (1:N) - Brand configurations
│   ├── Schedule (1:N) - Autopilot schedules
│   ├── Material (1:N) - Uploaded content
│   ├── ExternalSource (1:N) - Shopify, etc.
│   └── BrandProfileAccount (N:M) - Links to accounts
├── Post (1:N) - Published content
├── PendingPost (1:N) - Awaiting approval/publish
└── ContentEmbedding (1:N) - Vector deduplication
```

**Note:** SocialAccount ↔ BrandProfile is N:M. One Twitter account can be used by multiple brands.

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | PostgreSQL 15+ | Primary data store |
| ORM | Drizzle | Type-safe queries, native pgvector |
| Extensions | pgvector | 768-dim embeddings for deduplication |
| ID Generation | cuid2 | Collision-resistant unique IDs |

## Key Design Principles

1. **Organization-centric** - All data belongs to an Organization (billing unit)
2. **Autonomous by default** - `autoApprove=true`, minimal user intervention
3. **Soft delete** - `deletedAt` timestamp for data recovery and GDPR
4. **Denormalized scoping** - `organizationId` on all tables for fast queries
5. **JSON for complex configs** - Colors, language rules, platform settings

## Quick Commands

```bash
# Development
pnpm db:generate      # Generate migration SQL
pnpm db:push          # Apply schema to database
pnpm db:studio        # Open Drizzle Studio GUI
pnpm db:seed          # Seed test data

# Docker services
docker compose up -d  # Start PostgreSQL, Redis, MinIO
```

## File Structure

```
packages/database/
├── src/
│   ├── schema/
│   │   ├── index.ts          # Re-export all tables
│   │   ├── enums.ts          # PostgreSQL enums
│   │   ├── users.ts          # User (Better Auth)
│   │   ├── organization.ts   # Org, Member, Subscription
│   │   ├── brand-profile.ts  # Brand, Account, Schedule
│   │   ├── material.ts       # Material, ExternalSource
│   │   ├── post.ts           # Post, PendingPost
│   │   └── embedding.ts      # ContentEmbedding (pgvector)
│   ├── relations.ts          # Drizzle relations
│   ├── db.ts                 # Database connection
│   ├── types.ts              # JSON TypeScript types
│   └── index.ts              # Main exports
├── drizzle.config.ts         # Drizzle Kit config
└── migrations/               # Generated SQL migrations
```

---

*Document Version: v1.0 | Last Updated: 2026-01-11*
