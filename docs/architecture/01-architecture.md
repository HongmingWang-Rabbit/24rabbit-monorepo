# System Architecture

## System Overview

24Rabbit provides two entry points into the same content generation engine:

```
AUTOPILOT MODE (24/7 automated)          MANUAL MODE (user triggered)
├── Schedule triggers automatically      ├── User selects material
├── System selects materials             ├── User clicks "Generate"
├── Auto-generates content               ├── Reviews 3 variations
├── Optional: auto-approve and publish   ├── Edits if needed
└── No human intervention required       └── Approves and schedules
              │                                       │
              └───────────────┬───────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  CONTENT GENERATION ENGINE    │
              │        (shared core)          │
              └───────────────────────────────┘
```

## Complete System Flow

```
[User uploads material]
        │
        ▼
[Queue: content:analyze]
        │
        ▼
[AI Analysis + Embedding]
        │
        ▼
[Material status: READY]
        │
        ├── AUTOPILOT PATH ────────────────┐
        │   [Cron checks schedules]        │
        │          │                       │
        │          ▼                       │
        │   [Select material]              │
        │          │                       │
        │          ▼                       │
        │   [Similarity check]             │
        │          │                       │
        └──────────┴───────────────────────┘
                   │
                   ▼
        [Queue: content:generate]
                   │
                   ▼
        [Load context: Material + Brand + Recent Posts]
                   │
                   ▼
        [Build prompt with all branding]
                   │
                   ▼
        [Call Gemini AI]
                   │
                   ▼
        [Validate + Similarity check]
                   │
                   ▼
        [Create PendingPost with 3 variations]
                   │
                   ├── AUTO_APPROVED ──────┐
                   │                       │
                   ▼                       │
        [User reviews in dashboard]        │
        [Selects/edits/approves]           │
                   │                       │
                   ▼                       │
        [Status: APPROVED] ◄───────────────┘
                   │
                   ▼
        [Scheduled time arrives]
                   │
                   ▼
        [Queue: post:publish]
                   │
                   ▼
        [Rate limit check]
                   │
                   ▼
        [Call platform API]
                   │
                   ▼
        [Create Post record]
                   │
                   ▼
        [Queue: analytics:collect (hourly)]
                   │
                   ▼
        [Update metrics]
                   │
                   ▼
        [Dashboard shows performance]
```

## AI Processing Layer - Modular Design

Each AI function is an independent module implemented through Adapter interfaces:

```
┌─────────────────────────────────────────────────────────────┐
│                  AI Processing Layer (Modular)               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Analysis Adapters                  │   │
│  │  ┌─────────────┬─────────────┬─────────────┐       │   │
│  │  │   Image     │   Video     │    Text     │       │   │
│  │  │  Analyzer   │  Analyzer   │ Understanding│       │   │
│  │  │ ─────────── │ ─────────── │ ─────────── │       │   │
│  │  │ • Gemini    │ • Gemini    │ • Gemini    │       │   │
│  │  │ • GPT-4V    │ • GPT-4V    │ • Claude    │       │   │
│  │  │ • Claude    │             │ • GPT-4     │       │   │
│  │  └─────────────┴─────────────┴─────────────┘       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Generation Adapters                 │   │
│  │  ┌─────────────┬─────────────┬─────────────┐       │   │
│  │  │    Copy     │    Image    │    Video    │       │   │
│  │  │  Generator  │  Generator  │  Generator  │       │   │
│  │  │ ─────────── │ ─────────── │ ─────────── │       │   │
│  │  │ • Gemini    │ • Imagen    │ • Veo       │       │   │
│  │  │ • Claude    │ • DALL-E    │ • Runway    │       │   │
│  │  │ • GPT-4     │ • Midjourney│ • Pika      │       │   │
│  │  └─────────────┴─────────────┴─────────────┘       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Utility Adapters                  │   │
│  │  ┌─────────────┬─────────────┬─────────────┐       │   │
│  │  │  Embedding  │ Web Crawler │   Video     │       │   │
│  │  │  Generator  │             │  Processor  │       │   │
│  │  │ ─────────── │ ─────────── │ ─────────── │       │   │
│  │  │ • Gemini    │ • Firecrawl │ • FFmpeg    │       │   │
│  │  │ • OpenAI    │ • Crawlee   │ • Cloud Svc │       │   │
│  │  └─────────────┴─────────────┴─────────────┘       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Complete Adapter List

| Category | Adapter | Function | Default | Alternatives |
|----------|---------|----------|---------|--------------|
| **Analysis** | ImageAnalyzer | Analyze images, identify products | Gemini | GPT-4V, Claude |
| | VideoAnalyzer | Analyze videos, find best frames | Gemini | GPT-4V |
| | TextUnderstanding | Understand intent, extract info | Gemini | Claude, GPT-4 |
| **Generation** | CopyGenerator | Generate multi-platform copy | Gemini | Claude, GPT-4, Llama |
| | ImageGenerator | AI generate images | Imagen | DALL-E, Midjourney, SD |
| | VideoGenerator | AI generate short videos | Veo | Runway, Pika, Kling |
| **Utility** | EmbeddingGenerator | Generate vectors (for dedup) | Gemini | OpenAI, Cohere |
| | WebCrawler | Crawl e-commerce products | Firecrawl | Crawlee, Puppeteer |
| | VideoProcessor | Video screenshots, transcoding | FFmpeg | Cloud services |

## Redis Queues & Jobs

### Queue Definitions

| Queue | Trigger | Payload | Processor |
|-------|---------|---------|-----------|
| `content:analyze` | Material upload | `{materialId}` | ContentAnalyzer |
| `content:generate` | Schedule or manual | `{materialId, brandProfileId, platforms[], mode, scheduledFor, autoApprove, uniquePerPlatform}` | ContentGenerator |
| `post:publish` | Approved post at scheduled time | `{pendingPostId}` | PostPublisher |
| `analytics:collect` | Hourly cron | `{userId}` or `{postIds[]}` | AnalyticsCollector |
| `embedding:generate` | After content analysis or generation | `{contentType, contentId, content}` | EmbeddingGenerator |

### Job States

```
WAITING → ACTIVE → COMPLETED
                 → FAILED → RETRY (max 3) → DEAD
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| AI Engine | Gemini API (default) | Content understanding + generation |
| Protocol | MCP | Standardized AI-tool communication |
| Media Processing | FFmpeg | Video screenshots |
| Image Generation | Imagen API (default) | AI-generated images |
| Video Generation | Veo API (default) | AI-generated short videos |
| Vector Database | PostgreSQL + pgvector | Content deduplication |
| Object Storage | Cloudflare R2 / MinIO | User file uploads (images, videos) |
| Queue | Redis + BullMQ | Background job processing |

## Local Development Infrastructure

The following services are provided via `docker-compose.yml`:

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL (pgvector) | 5432 | Database with vector extensions |
| Redis | 6379 | Job queue backend |
| MinIO | 9000 (API), 9001 (Console) | S3-compatible storage (local R2 replacement) |

### MinIO (Local Object Storage)

MinIO provides S3-compatible storage for local development, replacing Cloudflare R2:

- **Console URL:** http://localhost:9001
- **Credentials:** `minioadmin` / `minioadmin`
- **Bucket:** `24rabbit` (auto-created on startup)

The bucket is automatically created by the `minio-init` container when you run `docker-compose up -d`.

---

*Related: [AI Processing](./02-ai-processing.md) | [MCP Tools](./06-mcp-tools.md)*
