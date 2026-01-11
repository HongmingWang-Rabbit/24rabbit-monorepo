# 24Rabbit

AI-powered social media marketing automation platform. Upload materials or connect e-commerce sites, and AI automatically generates and publishes content to multiple social platforms 24/7.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start local services (PostgreSQL + Redis)
docker compose up -d

# Set up environment
cp .env.example .env

# Push database schema
pnpm db:push

# Start development
pnpm dev
```

## Project Structure

```
24rabbit-monorepo/
├── apps/
│   ├── web/                # Next.js 14 web application
│   └── worker/             # BullMQ background job processor
├── packages/
│   ├── database/           # Prisma schema & client
│   ├── ai/                 # AI adapters (Gemini)
│   ├── platforms/          # Social platform connectors
│   ├── queue/              # BullMQ queue definitions
│   └── shared/             # Shared types & utilities
└── docs/                   # Product documentation
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run all tests |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to database |
| `pnpm db:studio` | Open Prisma Studio |

## Tech Stack

- **Frontend:** Next.js 14, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes, BullMQ
- **Database:** PostgreSQL with pgvector
- **AI:** Gemini API (default), supports multiple providers
- **Auth:** Better Auth
- **Payments:** Stripe

## Documentation

See the `docs/` folder for detailed documentation on architecture, AI processing, scheduling, and more.
