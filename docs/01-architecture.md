# System Architecture

## Overall Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Actions                          │
│              Upload Materials / Connect Sites / Configure    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Content Sources                         │
│         ┌──────────────────┬──────────────────┐            │
│         │  Material Pool   │    External      │            │
│         │  User uploads    │  E-commerce sites│            │
│         └──────────────────┴──────────────────┘            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 AI Scheduling Engine (Cron)                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. Check material pool → Any unused materials?      │   │
│  │  2. Crawl connected sites → Any unmarketed products? │   │
│  │  3. VectorDB dedup → Ensure no duplicate posts       │   │
│  │  4. Select content → Generate → Publish              │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  AI Processing Layer (Modular)               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   AI Adapter Interface               │   │
│  │  ┌─────────────┬─────────────┬─────────────┐       │   │
│  │  │   Gemini    │   OpenAI    │   Claude    │  ...  │   │
│  │  │  (Default)  │  (Adapter)  │  (Adapter)  │       │   │
│  │  └─────────────┴─────────────┴─────────────┘       │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Publishing Layer (MCP Server)              │
│     ┌─────┬─────┬─────┬─────┬─────┬─────┐                 │
│     │ YT  │  X  │ LI  │ RD  │ IG  │ FB  │                 │
│     └─────┴─────┴─────┴─────┴─────┴─────┘                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        VectorDB                              │
│              Records all published content for dedup         │
└─────────────────────────────────────────────────────────────┘
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

## Mixed Configuration Example

```yaml
ai_config:
  adapters:
    image_analyzer: claude
    video_analyzer: gemini
    text_understanding: claude
    copy_generator: claude
    image_generator: midjourney
    video_generator: veo
    embedding_generator: openai
    web_crawler: firecrawl
```

## Why Modular Design

| Advantage | Description |
|-----------|-------------|
| Flexibility | Choose the best provider for each function |
| Cost Optimization | Use cheaper models for less critical tasks |
| Quality Optimization | Use best models for important tasks |
| No Lock-in | Any module can be switched anytime |
| Easy Extension | New models can be added via new Adapters |

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| AI Engine | Gemini API (default) | Content understanding + generation |
| Protocol | MCP | Standardized AI-tool communication |
| Media Processing | FFmpeg | Video screenshots |
| Image Generation | Imagen API (default) | AI-generated images |
| Video Generation | Veo API (default) | AI-generated short videos |
| Vector Database | PostgreSQL + pgvector | Content deduplication |

---

*Related: [AI Processing](./02-ai-processing.md) | [MCP Tools](./06-mcp-tools.md)*
