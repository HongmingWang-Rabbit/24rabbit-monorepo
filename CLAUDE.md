# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

24Rabbit is an AI-powered social media marketing automation platform. Users upload materials or connect e-commerce sites, and AI automatically generates and publishes content to multiple social platforms 24/7.

## Commands

```bash
# Development
pnpm dev                    # Start all apps (web + worker) in dev mode
pnpm build                  # Build all packages and apps
pnpm lint                   # Lint all packages
pnpm test                   # Run all tests

# Database (Prisma)
pnpm db:generate            # Generate Prisma client after schema changes
pnpm db:push                # Push schema changes to database
pnpm db:seed                # Seed the database
pnpm db:studio              # Open Prisma Studio GUI

# Local services
docker-compose up -d        # Start PostgreSQL and Redis

# Run commands in specific package
pnpm --filter @24rabbit/web dev
pnpm --filter @24rabbit/worker build
```

## Architecture

### Monorepo Structure (Turborepo + pnpm workspaces)

**Apps:**
- `apps/web` (`@24rabbit/web`) - Next.js 14 App Router frontend and API routes
- `apps/worker` (`@24rabbit/worker`) - Background job processor using BullMQ

**Packages:**
- `packages/database` (`@24rabbit/database`) - Prisma schema, client, and migrations. PostgreSQL with pgvector for content deduplication.
- `packages/ai` (`@24rabbit/ai`) - AI adapter interface with Gemini implementation. Supports image/video analysis and content generation.
- `packages/platforms` (`@24rabbit/platforms`) - Social platform connectors (Facebook first, then Twitter, LinkedIn, etc.)
- `packages/queue` (`@24rabbit/queue`) - BullMQ queue definitions and worker factories for publish, schedule, and analytics jobs
- `packages/shared` (`@24rabbit/shared`) - Shared TypeScript types, constants (credit costs, platform limits), and utilities (encryption, retry logic)

### Data Flow

1. User uploads materials OR connects e-commerce site
2. AI Scheduling Engine (cron) scans for unused materials
3. AI Processing Layer analyzes content and generates platform-specific copy
4. Publishing Layer posts to connected social accounts
5. VectorDB records embeddings for deduplication

### Key Patterns

- **Workspace imports:** Use `@24rabbit/package-name` for cross-package imports
- **AI Adapters:** Implement `AIAdapter` interface in `packages/ai/src/types.ts` for new AI providers
- **Platform Connectors:** Implement `PlatformConnector` interface in `packages/platforms/src/types.ts` for new social platforms
- **Job Queues:** Use `createQueue<T>()` and `createWorker<T>()` from `@24rabbit/queue` for background jobs

### Database

PostgreSQL with pgvector extension. Schema in `packages/database/prisma/schema.prisma`. Key models:
- User/Subscription - Auth and billing
- SocialAccount/BrandProfile - Connected platforms and brand settings
- Material - User-uploaded content with usage tracking
- Post/PendingPost - Published and pending approval content
- ContentEmbedding - Vector embeddings for deduplication

### Environment

Copy `.env.example` to `.env`. Required variables:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis for BullMQ
- `GEMINI_API_KEY` - AI content generation
- `ENCRYPTION_KEY` - 32 bytes hex for token encryption

See `docs/` folder for detailed documentation on all subsystems.
