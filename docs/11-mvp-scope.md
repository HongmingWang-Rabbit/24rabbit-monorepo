# MVP Scope & Tech Stack

## MVP Definition (Phase 1)

**Goal:** Launch with Facebook support, prove core value proposition

### Feature Priorities

| Priority | Feature | Status |
|----------|---------|--------|
| **P0** | User auth (NextAuth) | Required |
| **P0** | Facebook OAuth connection | Required |
| **P0** | Brand profile setup | Required |
| **P0** | AI content generation (Gemini) | Required |
| **P0** | Manual publish to Facebook | Required |
| **P0** | Credit system & tracking | Required |
| **P0** | Stripe subscription | Required |
| **P1** | Scheduled auto-publish | Required |
| **P1** | Material upload & management | Required |
| **P1** | Simple dashboard | Required |
| **P1** | Approval workflow | Required |
| **P2** | Trending integration | Nice to have |
| **P2** | Analytics display | Nice to have |
| **P2** | VectorDB deduplication | Nice to have |

## Platform Rollout Plan

```
Phase 1 (MVP):     Facebook
Phase 2:           + Twitter/X, LinkedIn
Phase 3:           + Instagram, YouTube
Phase 4:           + Reddit, TikTok (when API available)
```

## Tech Stack (Finalized)

| Component | Technology | Reason |
|-----------|------------|--------|
| Frontend | Next.js 14 (App Router) | Full-stack, easy deployment |
| Styling | Tailwind + shadcn/ui | Fast development |
| Backend | Next.js API Routes | Unified codebase |
| Database | PostgreSQL (Neon/Supabase) | Free tier, pgvector support |
| ORM | Prisma | Type-safe, migrations |
| Queue | BullMQ + Redis (Upstash) | Serverless, reliable |
| AI | Gemini API | Large free tier, multimodal |
| Auth | NextAuth.js | Easy social login |
| Payments | Stripe | Industry standard |
| Storage | Cloudflare R2 | Cost-effective, S3-compatible |
| Deployment | Vercel | Auto-scaling, free tier |

## Monorepo Structure

```
24rabbit-monorepo/
├── apps/
│   ├── web/                    # Next.js web application (@24rabbit/web)
│   │   ├── app/                # App router pages
│   │   │   ├── (auth)/         # Auth pages
│   │   │   ├── (dashboard)/    # Dashboard pages
│   │   │   ├── api/            # API routes
│   │   │   └── layout.tsx
│   │   ├── components/         # React components
│   │   │   ├── ui/             # shadcn/ui components
│   │   │   └── features/       # Feature components
│   │   └── lib/                # Utilities
│   │       ├── auth.ts
│   │       ├── stripe.ts
│   │       └── utils.ts
│   │
│   └── worker/                 # Background job processor (@24rabbit/worker)
│       ├── src/
│       │   └── index.ts        # Worker entry
│       └── jobs/               # BullMQ job handlers
│           ├── publish.ts
│           ├── schedule.ts
│           └── analytics.ts
│
├── packages/
│   ├── database/               # Prisma schema & client (@24rabbit/database)
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/
│   │       └── index.ts
│   │
│   ├── ai/                     # AI adapters (@24rabbit/ai)
│   │   └── src/
│   │       ├── gemini.ts
│   │       ├── types.ts
│   │       └── index.ts
│   │
│   ├── platforms/              # Platform connectors (@24rabbit/platforms)
│   │   └── src/
│   │       ├── facebook.ts
│   │       ├── twitter.ts
│   │       └── index.ts
│   │
│   ├── queue/                  # BullMQ setup (@24rabbit/queue)
│   │   └── src/
│   │       ├── connection.ts
│   │       └── index.ts
│   │
│   └── shared/                 # Shared types & utils (@24rabbit/shared)
│       └── src/
│           ├── types.ts
│           └── index.ts
│
├── docs/                       # Documentation (this folder)
│
├── docker-compose.yml          # Local dev (Redis, Postgres)
├── turbo.json                  # Turborepo config
├── package.json                # Root package.json
├── pnpm-workspace.yaml         # pnpm workspace config
├── .gitignore
├── .npmrc
└── .env.example
```

## Configuration Files

### pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "db:generate": {},
    "db:push": {},
    "db:seed": {},
    "db:studio": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### Root package.json

```json
{
  "name": "24rabbit-monorepo",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "db:generate": "turbo run db:generate --filter=@24rabbit/database",
    "db:push": "turbo run db:push --filter=@24rabbit/database",
    "db:seed": "turbo run db:seed --filter=@24rabbit/database",
    "db:studio": "turbo run db:studio --filter=@24rabbit/database",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  }
}
```

## Environment Variables

```bash
# .env.example

# Database
DATABASE_URL="postgresql://..."

# Redis
REDIS_URL="redis://..."

# Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."

# OAuth - Facebook
FACEBOOK_CLIENT_ID="..."
FACEBOOK_CLIENT_SECRET="..."

# AI
GEMINI_API_KEY="..."

# Payments
STRIPE_SECRET_KEY="..."
STRIPE_WEBHOOK_SECRET="..."
STRIPE_PRICE_STARTER="price_..."
STRIPE_PRICE_GROWTH="price_..."
STRIPE_PRICE_BUSINESS="price_..."

# Storage
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="..."
R2_ENDPOINT="..."

# Encryption
ENCRYPTION_KEY="..."  # 32 bytes hex
```

## Development Workflow

### Local Setup

```bash
# 1. Clone and install
git clone https://github.com/xxx/24rabbit-monorepo
cd 24rabbit-monorepo
pnpm install

# 2. Start local services
docker compose up -d  # Redis, Postgres

# 3. Setup database
pnpm db:push
pnpm db:seed

# 4. Start development
pnpm dev  # Starts web + worker
```

### Scripts

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "db:generate": "turbo run db:generate --filter=@24rabbit/database",
    "db:push": "turbo run db:push --filter=@24rabbit/database",
    "db:seed": "turbo run db:seed --filter=@24rabbit/database",
    "db:studio": "turbo run db:studio --filter=@24rabbit/database",
    "clean": "turbo run clean && rm -rf node_modules"
  }
}
```

## Deployment

### Vercel (Web App)

```json
// vercel.json
{
  "buildCommand": "turbo run build --filter=@24rabbit/web",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install"
}
```

### Railway/Render (Worker)

```dockerfile
# apps/worker/Dockerfile
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@24rabbit/worker
CMD ["node", "apps/worker/dist/index.js"]
```

## Cost Estimation (MVP)

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Vercel | Hobby | $0 |
| Neon/Supabase | Free | $0 |
| Upstash Redis | Free | $0 |
| Gemini API | Free tier | $0 |
| Cloudflare R2 | Pay-as-go | ~$1 |
| **Total** | | **~$1/month** |

*Scales with usage; costs increase with paying customers*

---

*Related: [Architecture](./01-architecture.md) | [Data Model](./10-data-model.md)*
