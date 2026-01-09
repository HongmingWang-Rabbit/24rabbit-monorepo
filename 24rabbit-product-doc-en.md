# 24Rabbit Product Documentation

> AI-Powered 24/7 Social Media Marketing Automation Platform (Gemini + MCP)

---

## 1. Product Overview

### 1.1 What is 24Rabbit?

24Rabbit is a fully automated social media marketing tool. Users simply upload materials or connect their e-commerce websites, and AI will automatically generate content and publish to multiple social platforms 24/7.

### 1.2 Core Value Proposition

| Pain Point | 24Rabbit Solution |
|------------|-------------------|
| No time for marketing | AI runs 24/7 automatically |
| Don't know what to post | AI selects materials and generates content |
| Multi-platform posting is tedious | One input, multi-platform distribution |
| Content repetition/homogenization | VectorDB deduplication ensures content diversity |

### 1.3 Core Philosophy

**From "User Push" to "AI Pull"**

```
Traditional: User wants to post → Manual creation → Manual publishing
24Rabbit:   User uploads materials → AI scheduled scanning → Smart selection → Auto publishing
```

---

## 2. System Architecture

### 2.1 Overall Architecture

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
│         │  📤 Material Pool │  🌐 External     │            │
│         │  User uploads     │  E-commerce sites│            │
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
│                                                             │
│  Function Modules:                                          │
│  ┌───────────┬───────────┬───────────┬───────────┐        │
│  │  Content  │   Copy    │   Image   │   Video   │        │
│  │  Analysis │ Generation│ Generation│ Generation│        │
│  │  Adapter  │  Adapter  │  Adapter  │  Adapter  │        │
│  └───────────┴───────────┴───────────┴───────────┘        │
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

### 2.2 AI Processing Layer - Modular Design

Each AI function is an independent module implemented through Adapter interfaces, allowing individual selection of different providers:

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
│  │  │ • Llama     │ • SD        │ • Kling     │       │   │
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
│  │  │ • Cohere    │ • Puppeteer │             │       │   │
│  │  └─────────────┴─────────────┴─────────────┘       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Complete Adapter List:**

| Category | Adapter | Function | Default Provider | Alternative Providers |
|----------|---------|----------|------------------|----------------------|
| **Analysis** | ImageAnalyzer | Analyze images, identify products | Gemini | GPT-4V, Claude |
| | VideoAnalyzer | Analyze videos, find best frames | Gemini | GPT-4V |
| | TextUnderstanding | Understand intent, extract info | Gemini | Claude, GPT-4 |
| **Generation** | CopyGenerator | Generate multi-platform copy | Gemini | Claude, GPT-4, Llama |
| | ImageGenerator | AI generate images | Imagen | DALL-E, Midjourney, SD |
| | VideoGenerator | AI generate short videos | Veo | Runway, Pika, Kling |
| **Utility** | EmbeddingGenerator | Generate vectors (for dedup) | Gemini | OpenAI, Cohere |
| | WebCrawler | Crawl e-commerce products | Firecrawl | Crawlee, Puppeteer |
| | VideoProcessor | Video screenshots, transcoding | FFmpeg | Cloud services |

**Mixed Configuration Example:**

```yaml
# Users can configure different providers for each function
ai_config:
  adapters:
    # Use Claude for analysis (strong understanding)
    image_analyzer: claude
    video_analyzer: gemini      # Gemini video analysis is cheaper
    text_understanding: claude
    
    # Use Claude for copywriting (high quality)
    copy_generator: claude
    
    # Use Midjourney for images (best results)
    image_generator: midjourney
    
    # Use Veo for video (Google ecosystem)
    video_generator: veo
    
    # Use OpenAI for embeddings (industry standard)
    embedding_generator: openai
    
    # Use Firecrawl for crawling (professional)
    web_crawler: firecrawl
```

**Why Modular Design:**

| Advantage | Description |
|-----------|-------------|
| Flexibility | Choose the best provider for each function |
| Cost Optimization | Use cheaper models for less critical tasks |
| Quality Optimization | Use best models for important tasks |
| No Lock-in | Any module can be switched anytime |
| Easy Extension | New models can be added via new Adapters |

### 2.3 Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| AI Engine | Gemini API (default) | Content understanding + generation |
| Protocol | MCP | Standardized AI-tool communication |
| Media Processing | FFmpeg | Video screenshots |
| Image Generation | Imagen API (default) | AI-generated images |
| Video Generation | Veo API (default) | AI-generated short videos |
| Vector Database | PostgreSQL + pgvector | Content deduplication |

---

## 3. Brand Configuration

### 3.1 Brand Profile

Users need to set up basic brand information first. AI will maintain content consistency based on this:

| Setting | Description | Example |
|---------|-------------|---------|
| Brand Name | Brand/company name | OMECA |
| Brand Tagline | One-line description | Professional restaurant supply provider |
| Target Audience | Who are the customers | Restaurant owners, hotel buyers, F&B entrepreneurs |
| Brand Tone | Content style | Professional, reliable, premium |
| Core Selling Points | Product advantages | Wholesale prices, quality guarantee, fast delivery |
| Forbidden Words | Words to avoid | Cheapest, #1, absolutely, guaranteed |
| Competitor Info | Brands not to mention | [Competitor list] |

### 3.2 Content Instructions

Users can set specific content generation rules:

**General Instructions**
```
Examples:
- Every post must include brand name "OMECA"
- Display prices in USD
- Add website link at the end
- Use no more than 3 emojis
- Keep tone professional but friendly, not too salesy
```

**Platform-Specific Instructions**
```
Twitter:
- Keep under 200 characters
- Use 2-3 relevant hashtags

LinkedIn:
- Can be longer, tell product stories
- Include industry insights
- Use professional terminology

Instagram:
- Focus on visuals
- Can use more emojis
- Put hashtags at the end, can use more
```

**Content Type Instructions**
```
New Product Launch:
- Emphasize "new", "just arrived"
- Highlight product features
- Include limited-time offers (if any)

Daily Marketing:
- Share use cases
- Customer testimonials
- Industry tips

Promotional Campaign:
- Highlight discount amount
- Emphasize deadline
- Create urgency
```

### 3.3 How AI Uses These Configurations

```
When Generating Content
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Load Brand Configuration                        │
│  • Brand Profile → Determine content direction   │
│  • General Instructions → Apply to all content   │
│  • Platform Instructions → Platform-specific     │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  AI Generate Content                             │
│  System Prompt = Profile + Instructions + Input  │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Content Validation                              │
│  • Check forbidden words                         │
│  • Check if brand name included                  │
│  • Check if length meets platform requirements   │
│  • Failed → Regenerate                           │
└─────────────────────────────────────────────────┘
```

### 3.4 Configuration Example: OMECA

```yaml
brand_profile:
  name: "OMECA"
  tagline: "Professional Restaurant Supply Provider"
  target_audience: 
    - Restaurant owners
    - Hotel procurement managers
    - F&B entrepreneurs
  tone: "professional, reliable, helpful"
  selling_points:
    - Wholesale prices, save costs
    - Quality guarantee, worry-free after-sales
    - Vancouver local, fast delivery
  forbidden_words:
    - cheapest
    - number one
    - absolutely
  website: "https://omeca.ca"

content_instructions:
  general:
    - Every post includes brand name OMECA
    - Prices in CAD or USD
    - Add website link at the end
    - Keep professional and friendly tone
    
  platforms:
    twitter:
      - Short and punchy, under 200 characters
      - 2-3 hashtags
    linkedin:
      - Can be more detailed, tell product stories
      - Include F&B industry insights
    instagram:
      - Visual first
      - Can use more emojis
```

---

## 4. Content Sources

### 4.1 Source Priority

```
Priority 1: 📤 User-uploaded materials (unused)
    ↓
Priority 2: 📤 User-uploaded materials (used before)
    ↓
Priority 3: 🌐 Unmarketed products from connected websites
    ↓
Priority 4: 🔄 High-performing historical content (repackaged)
```

### 4.2 Material Pool

Users can upload three types of materials:

| Type | Example | AI Processing |
|------|---------|---------------|
| 📹 Video | Product demo video | Analyze → Find best frame timestamps → Screenshot |
| 🖼️ Image | Product photos | Analyze features → Crop/resize for platforms |
| 📝 Text | Product description | Understand intent → Optionally generate images |

**Material Status Management:**
- `unused` - Never used, highest priority
- `used_once` - Used once
- `used_multiple` - Used multiple times, lowest priority

### 4.3 External Data Sources

Users can connect e-commerce websites, AI will automatically crawl product info:

| Platform | Integration Method |
|----------|-------------------|
| Shopify | API integration |
| WooCommerce | API integration |
| Custom website | Web crawling |

**Crawling Logic:**
1. Traverse product catalog
2. Extract product info (name, price, images, description)
3. Generate embedding, compare with VectorDB
4. Filter out unmarketed products

---

## 5. AI Processing Workflow

### 5.1 Video Input Workflow

```
User uploads product video
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Video Analysis (VideoAnalyzer Adapter)              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • Identify product features (material, color, style) │   │
│  │  • Identify scene (indoor/outdoor, restaurant/home)   │   │
│  │  • Find best screenshot timestamps (multiple)         │   │
│  │  • Extract core selling points                        │   │
│  │  • Detect brand/logo positions                        │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Video Screenshots (VideoProcessor Adapter)          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Input: Multiple timestamps from AI analysis          │   │
│  │                                                      │   │
│  │  Screenshot Strategy:                                │   │
│  │  • Full product shots (1-2) - Show complete product  │   │
│  │  • Detail close-ups (2-3) - Material, craft, details │   │
│  │  • Usage scene shots (1-2) - Product in environment  │   │
│  │  • Size comparison (optional) - If video has it      │   │
│  │                                                      │   │
│  │  Output: 5-8 HD screenshots                          │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Image Processing (ImageProcessor)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Background Processing:                              │   │
│  │  • Remove background → Transparent PNG (for comp)    │   │
│  │  • White background → E-commerce standard            │   │
│  │  • Keep original → Scene shot                        │   │
│  │                                                      │   │
│  │  Size Adaptation:                                    │   │
│  │  • 1:1 square (Instagram, Facebook)                  │   │
│  │  • 16:9 landscape (YouTube, Twitter, LinkedIn)       │   │
│  │  • 9:16 portrait (Stories, Reels)                    │   │
│  │  • 4:5 portrait (Instagram Feed)                     │   │
│  │                                                      │   │
│  │  Enhancement:                                        │   │
│  │  • Auto crop (keep product subject)                  │   │
│  │  • Brightness/contrast optimization                  │   │
│  │  • Sharpening                                        │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Content Generation (Multi-format)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  📹 Video Content (VideoGenerator Adapter)           │   │
│  │  • 15-sec short video (Reels/TikTok style)           │   │
│  │  • Product showcase video (multi-angle carousel)     │   │
│  │  • Original video edited (highlight clips)           │   │
│  │                                                      │   │
│  │  🖼️ Image + Text Content                             │   │
│  │  • Single image + caption                            │   │
│  │  • Multi-image carousel (up to 10)                   │   │
│  │  • Collage/comparison image                          │   │
│  │                                                      │   │
│  │  📝 Text-only Content                                │   │
│  │  • Long copy (LinkedIn articles)                     │   │
│  │  • Short copy (Twitter)                              │   │
│  │  • Link-included copy (traffic driving)              │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 5: Platform-Adapted Publishing                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  YouTube    → Video + long description + thumbnail   │   │
│  │  Instagram  → Image carousel / Reels / Stories       │   │
│  │  Twitter    → Single/multi image + short copy / video│   │
│  │  LinkedIn   → Image + professional copy / video      │   │
│  │  Facebook   → Image / video / Stories                │   │
│  │  Reddit     → Image + discussion-style copy          │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Image Input Workflow

```
User uploads product images (can be multiple)
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Image Analysis (ImageAnalyzer Adapter)              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • Identify product (material, color, style, category)│   │
│  │  • Identify scene (restaurant/home/outdoor)           │   │
│  │  • Identify image type (hero/detail/scene/comparison) │   │
│  │  • Extract selling points                             │   │
│  │  • Assess image quality                               │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Image Processing (ImageProcessor)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Background Processing:                              │   │
│  │  • Remove background → Transparent PNG               │   │
│  │  • White background → E-commerce standard            │   │
│  │  • Replace with scene → AI-generated background      │   │
│  │                                                      │   │
│  │  Size Adaptation:                                    │   │
│  │  • Generate all platform-required sizes              │   │
│  │                                                      │   │
│  │  Enhancement:                                        │   │
│  │  • HD upscaling (if original is small)               │   │
│  │  • Color optimization                                │   │
│  │  • Blemish removal                                   │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Content Generation (Multi-format)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  📹 Video Content (optional)                         │   │
│  │  • Image slideshow video (multi-image composite)     │   │
│  │  • Dynamic display video (zoom, pan effects)         │   │
│  │  • AI-generated product video (Veo/Runway)           │   │
│  │                                                      │   │
│  │  🖼️ Image + Text Content                             │   │
│  │  • Single image + caption                            │   │
│  │  • Multi-image carousel                              │   │
│  │  • Comparison/collage image                          │   │
│  │                                                      │   │
│  │  📝 Text-only Content                                │   │
│  │  • Platform-adapted copy                             │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                  Platform-Adapted Publishing
```

### 5.3 Text-Only Input Workflow

```
User inputs text description
"OMECA new product, stainless steel cutlery set, $49, targeting upscale restaurants"
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Text Understanding (TextUnderstanding Adapter)      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • Extract: brand, product, price, target audience    │   │
│  │  • Supplement: use cases, inferred selling points     │   │
│  │  • Determine: content tone, style direction           │   │
│  │  • Decide: whether to generate images                 │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Material Acquisition (optional)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Option A: Match from Material Pool                   │   │
│  │  • Search existing materials for related products     │   │
│  │                                                      │   │
│  │  Option B: AI Generate Image (ImageGenerator)         │   │
│  │  • Generate product image based on description        │   │
│  │  • Generate scene image                               │   │
│  │                                                      │   │
│  │  Option C: Fetch from Website                         │   │
│  │  • If e-commerce connected, fetch product images      │   │
│  │                                                      │   │
│  │  Option D: Text Only                                  │   │
│  │  • No image needed, generate text-only content        │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Content Generation (Multi-format)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  📹 Video Content (if materials available)           │   │
│  │  • AI-generated product showcase video               │   │
│  │                                                      │   │
│  │  🖼️ Image + Text (if images available)               │   │
│  │  • Image + marketing copy                            │   │
│  │                                                      │   │
│  │  📝 Text-only Content                                │   │
│  │  • Platform-adapted copy                             │   │
│  │  • Link-included traffic driving copy                │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                  Platform-Adapted Publishing
```

### 5.4 Generated Content Format Summary

Based on material type and platform requirements, the system generates the following content formats:

| Content Format | Description | Suitable Platforms |
|----------------|-------------|-------------------|
| **Video** | | |
| Short video (15-60s) | Reels/TikTok style, fast-paced | Instagram, TikTok, YouTube Shorts |
| Product showcase video | Multi-angle display, with subtitles | YouTube, Facebook, LinkedIn |
| Dynamic image video | Static images with motion effects | All video-supporting platforms |
| **Image + Text** | | |
| Single image + caption | One featured image + marketing copy | Twitter, LinkedIn, Facebook |
| Multi-image carousel | 3-10 images combined | Instagram, LinkedIn, Facebook |
| Collage/comparison | Multiple images merged into one | All platforms |
| **Text Only** | | |
| Short copy | < 280 characters | Twitter |
| Medium copy | 1-3 paragraphs | Facebook, Instagram |
| Long copy | Article format | LinkedIn, Reddit |
| Link-included copy | Traffic driving to website | All platforms |

### 5.5 Platform Content Adaptation

| Platform | Preferred Format | Image Size | Video Spec | Copy Length |
|----------|-----------------|------------|------------|-------------|
| YouTube | Video | 16:9 thumbnail | Landscape 16:9 | Long description OK |
| Instagram Feed | Image carousel | 1:1 or 4:5 | 1:1 or 4:5 | 2200 chars |
| Instagram Reels | Short video | - | 9:16 portrait | Short |
| Twitter | Single image/video | 16:9 | 16:9 | 280 chars |
| LinkedIn | Image/video | 1.91:1 | Landscape | 3000 chars |
| Facebook | Image/video | Various | Various | Long OK |
| Reddit | Image + text | No limit | No limit | Title short, body long OK |

---

## 6. Intelligent Scheduling System

### 6.1 Scheduling Logic

```
Scheduled trigger (every X hours)
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Step 1: Check Material Pool                     │
│  Any unused materials?                           │
│  ├── Yes → Select highest priority material      │
│  └── No  → Go to Step 2                          │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Step 2: Crawl Connected Websites                │
│  Any unmarketed products?                        │
│  ├── Yes → Select one product                    │
│  └── No  → Go to Step 3                          │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Step 3: Reuse Historical Content                │
│  Select high-performing content, repackage       │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Step 4: Generate & Publish                      │
│  • AI generates content                          │
│  • Publish to platforms                          │
│  • Record to VectorDB                            │
│  • Update material status                        │
└─────────────────────────────────────────────────┘
```

### 6.2 VectorDB Deduplication Mechanism

**Purpose:** Avoid publishing duplicate/similar content

**How it works:**
1. Before each publish, generate embedding for the content
2. Compare similarity with existing content in VectorDB
3. Similarity > 0.9 → Determined as duplicate, skip
4. Similarity < 0.9 → Allow publish, record to VectorDB

---

## 7. Supported Platforms

### 7.1 Official API Support ✅

| Platform | API | Supported Features |
|----------|-----|-------------------|
| YouTube | Data API v3 | Video upload, Community Post |
| Twitter/X | API v2 | Tweet, media upload |
| LinkedIn | Marketing API | Post, company page |
| Reddit | API | Post, comment |
| Instagram | Graph API | Post (requires Business account) |
| Facebook | Graph API | Post, page management |

### 7.2 Not Yet Supported ⏳

| Platform | Reason |
|----------|--------|
| Xiaohongshu (RED) | No posting API (e-commerce API only) |
| Douyin | Limited API functionality |
| TikTok | Limited API functionality |

---

## 8. MCP Tool Interface

### 8.1 MCP Architecture

```
┌─────────────────────────────────────┐
│          Gemini API                 │
│        (MCP Client)                 │
└──────────────────┬──────────────────┘
                   │
            ⚡ MCP Protocol ⚡
                   │
                   ▼
┌─────────────────────────────────────┐
│      24Rabbit MCP Server            │
│        (Tools Provider)             │
└─────────────────────────────────────┘
```

### 8.2 Tool Categories

**Material Management**
| Tool | Function |
|------|----------|
| `upload_material` | Upload material to pool |
| `get_material_pool` | Get material pool status |
| `update_material_status` | Update material usage status |

**External Data Sources**
| Tool | Function |
|------|----------|
| `bind_external_source` | Connect Shopify/e-commerce site |
| `crawl_external_source` | Crawl product list |
| `get_unmarked_products` | Get unmarketed products |

**Content Processing**
| Tool | Function |
|------|----------|
| `analyze_content` | Analyze video/image/text |
| `extract_frames` | Video screenshots |
| `optimize_image` | Image optimization (platform sizing) |
| `generate_image` | AI generate images |
| `generate_copy` | Generate multi-platform copy |

**Publishing Management**
| Tool | Function |
|------|----------|
| `post_content` | Single platform publish |
| `schedule_post` | Scheduled publish |
| `cross_post` | Cross-platform one-click publish |

**Intelligent Scheduling**
| Tool | Function |
|------|----------|
| `trigger_publish` | Manually trigger publish |
| `preview_next_publish` | Preview next publish content |
| `check_content_similarity` | VectorDB dedup check |

**Analytics**
| Tool | Function |
|------|----------|
| `get_analytics` | Get post performance data |
| `get_trending` | Get platform trending topics |

---

## 9. Use Case Example

### Scenario: OMECA Restaurant Supply Auto-Marketing

**Initial Setup:**
- Material pool: Upload 20 product images
- Connected: Shopify store (100+ products)
- Schedule: Publish every 8 hours
- Platforms: Twitter, LinkedIn, Instagram

**Automatic Operation Process:**

```
Day 1-7: Consuming Material Pool
┌─────────────────────────────────────────────────┐
│  Auto-publish every 8 hours                      │
│  • Select unused image from material pool        │
│  • Generate copy, publish to 3 platforms         │
│  • Mark material as "used"                       │
└─────────────────────────────────────────────────┘

Day 8+: Material Pool Exhausted, Switch to Shopify
┌─────────────────────────────────────────────────┐
│  Check material pool → Empty                     │
│  Crawl Shopify → 100 products                    │
│  VectorDB compare → 80 unmarketed                │
│  Select 1 product → Generate content → Publish   │
└─────────────────────────────────────────────────┘

Day 30+: Fully Automated
┌─────────────────────────────────────────────────┐
│  • New uploaded materials → Priority publish     │
│  • New products listed → Auto-discover & market  │
│  • No manual intervention needed                 │
└─────────────────────────────────────────────────┘
```

---

## 10. User Interaction Examples

### Example 1: Video Input

```
User: [uploads product video] "This plate $15, please post it"

24Rabbit:
  📹 Analyzing video...
  ✅ Identified: White ceramic plate, gold rim, upscale restaurant style
  ✅ Best frames: 00:05, 00:12, 00:18
  ✅ Generated 6 screenshots
  ✅ Background removed, platform sizes created
  ✅ Generated copy for 6 platforms
  
  📤 Publishing...
  ✅ Twitter - Posted
  ✅ LinkedIn - Posted
  ✅ Instagram - Posted
  
  🎉 Done!
```

### Example 2: Image Input

```
User: [uploads cutlery image] "New product, $49, targeting upscale restaurants"

24Rabbit:
  🖼️ Analyzing image...
  ✅ Identified: Stainless steel cutlery set, business minimalist style
  ✅ Adjusted copy tone for "upscale restaurant" positioning
  ✅ Generated EN/CN bilingual versions
  
  📤 Which platforms to publish?
  [All] [Select Platforms] [Schedule]
```

### Example 3: Fully Automatic Mode

```
User: (does nothing)

24Rabbit Backend:
  ⏰ Scheduled task triggered (8:00 AM)
  📦 Check material pool → Found 3 unused materials
  🎯 Selected: Product image #1
  ✨ Generating copy...
  📤 Publishing to Twitter, LinkedIn, Instagram
  ✅ Done, next publish: 4:00 PM
```

---

*Document Version: v1.0*
*Last Updated: 2026-01-09*
