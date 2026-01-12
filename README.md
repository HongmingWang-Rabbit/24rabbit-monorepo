# 24Rabbit

AI-powered social media marketing automation platform. Upload materials or connect e-commerce sites, and AI automatically generates and publishes content to multiple social platforms 24/7.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start local services (PostgreSQL, Redis, MinIO)
docker compose up -d

# Set up environment
cp .env.example .env.local

# Push database schema
pnpm db:push

# Start development
pnpm dev
```

## Project Structure

```
24rabbit-monorepo/
├── apps/
│   ├── web/                # Next.js 15 web application
│   └── worker/             # BullMQ background job processor
├── packages/
│   ├── database/           # Drizzle ORM schema & migrations
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
| `pnpm lint` | Lint all packages (ESLint 9 flat config) |
| `pnpm test` | Run all tests (Vitest) |
| `pnpm db:generate` | Generate Drizzle migration SQL |
| `pnpm db:push` | Push schema to database (dev) |
| `pnpm db:migrate` | Run migrations (production) |
| `pnpm db:studio` | Open Drizzle Studio |

## Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes, BullMQ
- **Database:** PostgreSQL with pgvector, Drizzle ORM
- **AI:** Gemini API (default), supports multiple providers
- **Auth:** Better Auth
- **i18n:** next-intl (6 languages)
- **Storage:** Cloudflare R2 (MinIO for local dev)
- **Payments:** Stripe
- **Testing:** Vitest
- **Linting:** ESLint 9 (flat config), Prettier

## Frontend Architecture

### Design System

- **Typography:** Poppins (headings) + Open Sans (body)
- **Primary Color:** #2563EB (blue)
- **CTA Color:** #F97316 (orange)
- **Dark Mode:** System preference detection with manual toggle

### Internationalization (i18n)

Supports 6 languages via `next-intl`:

| Code | Language |
|------|----------|
| `en` | English |
| `zh` | 简体中文 |
| `fr` | Français |
| `ru` | Русский |
| `es` | Español |
| `de` | Deutsch |

Translation files are located in `apps/web/messages/`.

### Key Frontend Directories

```
apps/web/
├── app/[locale]/           # i18n-aware pages
│   ├── (auth)/             # Public auth pages
│   ├── (dashboard)/        # Protected dashboard
│   └── page.tsx            # Landing page
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Sidebar, header, nav components
│   └── providers/          # Theme, session providers
├── lib/
│   ├── constants/          # Shared constants (platforms, status)
│   ├── hooks/              # Custom React hooks
│   └── auth-client.ts      # Better Auth client
├── i18n/                   # next-intl configuration
└── messages/               # Translation JSON files
```

## Development

### Local Services

```bash
# Start PostgreSQL (5433), Redis (6379), MinIO (9000/9001)
docker compose up -d

# View logs
docker compose logs -f
```

### Pre-commit Hooks

This project uses Husky + lint-staged to run ESLint and Prettier on staged files before each commit.

## Documentation

See the `docs/` folder for detailed documentation on architecture, AI processing, scheduling, and more.
