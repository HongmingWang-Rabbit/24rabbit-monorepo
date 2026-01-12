# AI Processing Workflows

## Material Ingestion Pipeline

### Input Types (4 Sources)

| Source | Description |
|--------|-------------|
| Text Notes | Direct text input |
| URL | Blog posts, articles |
| Files | PDF, DOCX, TXT |
| Images/Videos | Media files |

### Ingestion Flow

```
[User Upload]
        │
        ▼
┌─────────────────────────────────────┐
│ CONTENT EXTRACTOR                   │
├─────────────────────────────────────┤
│ Text → use directly                 │
│ URL → scrape with Cheerio/Puppeteer │
│ PDF/DOCX → parse with pdf-parse     │
│ Image → describe with Gemini Vision │
│ Video → transcribe with Whisper API │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ AI ANALYZER (Gemini)                │
├─────────────────────────────────────┤
│ Extract:                            │
│ • summary (string)                  │
│ • keyPoints (string[])              │
│ • keywords (string[])               │
│ • contentType (string)              │
│ • suggestedAngles (string[])        │
│ • sentiment (string)                │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ EMBEDDING GENERATOR (Gemini)        │
├─────────────────────────────────────┤
│ Generate 768-dimension vector       │
│ Used for:                           │
│ • Similarity detection              │
│ • Duplicate prevention              │
│ • Content clustering                │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ STORAGE                             │
├─────────────────────────────────────┤
│ PostgreSQL:                         │
│ • Material record                   │
│ • ContentEmbedding (pgvector)       │
│                                     │
│ Cloudflare R2:                      │
│ • Original files                    │
│ • Extracted images                  │
└─────────────────────────────────────┘
```

### Material Status Flow

```
UPLOADED → PROCESSING → ANALYZED → READY → USED
```

## Content Generation Engine (Core)

Worker picks up job from Redis queue: `content:generate`

### Step 1: Load Context

```
┌─────────────────────────────────────┐
│ Fetch from PostgreSQL:              │
├─────────────────────────────────────┤
│ • Material                          │
│   - content, summary, keyPoints     │
│   - suggestedAngles, keywords       │
│                                     │
│ • BrandProfile                      │
│   - ALL branding data               │
│   - customContext (user's text)     │
│   - voice, tone, examples           │
│   - platformSettings                │
│                                     │
│ • Recent Posts (last 20)            │
│   - For variety/avoiding repetition │
│                                     │
│ • Platform Rules                    │
│   - Character limits                │
│   - Media requirements              │
│   - Best practices                  │
└─────────────────────────────────────┘
```

### Step 2: Build Prompt

```
┌─────────────────────────────────────────────────────────────────┐
│ PROMPT STRUCTURE                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ SYSTEM: You are a social media content creator for {brand.name} │
│                                                                 │
│ ═══ BRAND CONTEXT ═══                                           │
│ {brand.customContext}                                           │
│ ← User's free-form instructions injected verbatim               │
│                                                                 │
│ ═══ TARGET AUDIENCE ═══                                         │
│ {brand.targetAudience}                                          │
│                                                                 │
│ ═══ VOICE & TONE ═══                                            │
│ Personality: {brand.personality}                                │
│ Tone: {brand.tone.join(", ")}                                   │
│ Words to USE: {brand.languageRules.wordsToUse.join(", ")}       │
│ Words to AVOID: {brand.languageRules.wordsToAvoid.join(", ")}   │
│ Emoji usage: {brand.languageRules.emojiUsage}                   │
│ Hashtag style: {brand.languageRules.hashtagStyle}               │
│ CTA style: {brand.languageRules.ctaStyle}                       │
│                                                                 │
│ ═══ EXAMPLE POSTS (Few-shot learning) ═══                       │
│ {brand.examplePosts.map(p => p.content).join("\n")}             │
│                                                                 │
│ ═══ PLATFORM RULES ═══                                          │
│ Platform: {platform}                                            │
│ Character limit: {platformRules.charLimit}                      │
│ {brand.platformSettings[platform].customContextOverride || ""}  │
│                                                                 │
│ ═══ RECENT POSTS (Avoid similarity) ═══                         │
│ Do not repeat themes from these recent posts:                   │
│ {recentPosts.map(p => "- " + p.content.slice(0,100)).join("\n")}│
│                                                                 │
│ ═══ SOURCE MATERIAL ═══                                         │
│ {material.content}                                              │
│                                                                 │
│ Key points: {material.keyPoints.join(", ")}                     │
│ Suggested angles: {material.suggestedAngles.join(", ")}         │
│                                                                 │
│ ═══ INSTRUCTIONS ═══                                            │
│ Generate 3 unique variations for this platform.                 │
│ Each variation must:                                            │
│ - Use a different angle/hook                                    │
│ - Match the brand voice exactly                                 │
│ - Stay within character limits                                  │
│ - Be ready to publish (no placeholders)                         │
│                                                                 │
│ Respond in JSON format:                                         │
│ {                                                               │
│   "variations": [                                               │
│     {                                                           │
│       "content": "...",                                         │
│       "angle": "product focus | user benefit | storytelling",   │
│       "hashtags": ["tag1", "tag2"],                             │
│       "characterCount": 240                                     │
│     }                                                           │
│   ]                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Step 3: Call AI (Gemini)

```
┌─────────────────────────────────────┐
│ API Call to Gemini                  │
├─────────────────────────────────────┤
│ Model: gemini-2.0-flash (default)   │
│ Temperature: 0.8 (creative)         │
│ Response format: JSON               │
│                                     │
│ Response: {                         │
│   variations: [                     │
│     {content, angle, hashtags},     │
│     {content, angle, hashtags},     │
│     {content, angle, hashtags}      │
│   ]                                 │
│ }                                   │
└─────────────────────────────────────┘
```

### Step 4: Validate Output

```
┌─────────────────────────────────────┐
│ For each variation, check:          │
├─────────────────────────────────────┤
│ ✓ Within character limit?           │
│ ✓ No banned words present?          │
│ ✓ Required words included?          │
│ ✓ Proper JSON structure?            │
│ ✓ No placeholder text?              │
│ ✓ Passes content policy?            │
│                                     │
│ If fails:                           │
│ → Regenerate that variation         │
│ → Max 3 retry attempts              │
└─────────────────────────────────────┘
```

### Step 5: Similarity Check (Post-generation)

```
┌─────────────────────────────────────┐
│ Generate embedding for each         │
│ variation content                   │
├─────────────────────────────────────┤
│ Compare against recent posts:       │
│                                     │
│ Similarity scores:                  │
│ 0.0 - 0.5 → Unique ✓                │
│ 0.5 - 0.7 → Different enough ✓      │
│ 0.7 - 0.85 → Similar, but OK ⚠      │
│ 0.85 - 1.0 → Too similar ✗          │
│             → Regenerate            │
└─────────────────────────────────────┘
```

### Step 6: Platform Adaptation (if multi-platform)

```
┌─────────────────────────────────────┐
│ If uniquePerPlatform = false:       │
├─────────────────────────────────────┤
│ Take best variation, adapt:         │
│                                     │
│ Twitter (280) → LinkedIn (3000)     │
│ • Expand with more context          │
│ • Add professional framing          │
│ • Adjust hashtag style              │
│ • Apply platform tone override      │
│                                     │
│ If uniquePerPlatform = true:        │
│ → Run full generation per platform  │
└─────────────────────────────────────┘
```

### Step 7: Store Results

```
┌─────────────────────────────────────┐
│ Create PendingPost records          │
├─────────────────────────────────────┤
│ PendingPost {                       │
│   userId                            │
│   brandProfileId                    │
│   materialId                        │
│   platform                          │
│                                     │
│   variations: [                     │
│     {content, angle, hashtags},     │
│     {content, angle, hashtags},     │
│     {content, angle, hashtags}      │
│   ]                                 │
│   selectedVariation: 0              │
│   finalContent: variations[0]       │
│                                     │
│   scheduledFor: datetime            │
│   generationMode: "autopilot"       │
│                                     │
│   status:                           │
│   → "AUTO_APPROVED" if autoApprove  │
│   → "PENDING" if needs review       │
│                                     │
│   embedding: vector(768)            │
│ }                                   │
└─────────────────────────────────────┘
```

## Video Input Workflow

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
│  │  • Remove background → Transparent PNG               │   │
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
│  │  • Auto crop, brightness/contrast, sharpening        │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Content Generation (Multi-format)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Video Content:                                      │   │
│  │  • 15-sec short video (Reels/TikTok style)           │   │
│  │  • Product showcase video (multi-angle)              │   │
│  │  • Original video edited (highlight clips)           │   │
│  │                                                      │   │
│  │  Image + Text Content:                               │   │
│  │  • Single image + caption                            │   │
│  │  • Multi-image carousel (up to 10)                   │   │
│  │  • Collage/comparison image                          │   │
│  │                                                      │   │
│  │  Text-only Content:                                  │   │
│  │  • Long copy (LinkedIn), Short copy (Twitter)        │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                  Platform-Adapted Publishing
```

## Image Input Workflow

```
User uploads product images
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Image Analysis (ImageAnalyzer Adapter)              │
│  • Identify product (material, color, style, category)      │
│  • Identify scene (restaurant/home/outdoor)                 │
│  • Identify image type (hero/detail/scene/comparison)       │
│  • Extract selling points                                   │
│  • Assess image quality                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Image Processing                                    │
│  • Background: Remove / White / AI-generated scene          │
│  • Size: Generate all platform-required sizes               │
│  • Enhancement: HD upscaling, color optimization            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Content Generation                                  │
│  • Video: Slideshow, dynamic display, AI-generated          │
│  • Image + Text: Single, carousel, collage                  │
│  • Text-only: Platform-adapted copy                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                  Platform-Adapted Publishing
```

## Text-Only Input Workflow

```
User inputs: "OMECA new product, stainless steel cutlery set, $49"
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Text Understanding                                  │
│  • Extract: brand, product, price, target audience          │
│  • Supplement: use cases, inferred selling points           │
│  • Determine: content tone, style direction                 │
│  • Decide: whether to generate images                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Material Acquisition (optional)                     │
│  Option A: Match from Material Pool                         │
│  Option B: AI Generate Image                                │
│  Option C: Fetch from Connected Website                     │
│  Option D: Text Only                                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                  Content Generation → Publishing
```

## Visual Content Generation (Future)

When post needs visual:

```
[Content + Brand Profile]
        │
        ▼
┌─────────────────────────────────────┐
│ TEMPLATE SELECTOR                   │
├─────────────────────────────────────┤
│ Template types:                     │
│ • Quote Card                        │
│ • Stats/Milestone Card              │
│ • Announcement Card                 │
│ • Tips List Card                    │
│ • Behind the Scenes                 │
│                                     │
│ Selection based on:                 │
│ • Content type                      │
│ • Material category                 │
│ • Platform requirements             │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ APPLY BRANDING                      │
├─────────────────────────────────────┤
│ From BrandProfile:                  │
│ • colors.primary, secondary, accent │
│ • logo / icon overlay               │
│ • visualStyle affects layout        │
│ • fontPreference for text           │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ RENDER IMAGE                        │
├─────────────────────────────────────┤
│ Options:                            │
│ • HTML/CSS → Puppeteer screenshot   │
│ • Cloudinary transformations        │
│ • Canvas API rendering              │
│ • AI generation (DALL-E/Midjourney) │
└─────────────────────────────────────┘
        │
        ▼
[Upload to R2, attach to post]
```

## Generated Content Formats

| Format | Description | Platforms |
|--------|-------------|-----------|
| **Video** | | |
| Short video (15-60s) | Reels/TikTok style | Instagram, TikTok, YouTube Shorts |
| Product showcase | Multi-angle, subtitles | YouTube, Facebook, LinkedIn |
| Dynamic image video | Motion effects | All platforms |
| **Image + Text** | | |
| Single image + caption | Featured image | Twitter, LinkedIn, Facebook |
| Multi-image carousel | 3-10 images | Instagram, LinkedIn, Facebook |
| Collage/comparison | Merged images | All platforms |
| **Text Only** | | |
| Short copy | < 280 chars | Twitter |
| Medium copy | 1-3 paragraphs | Facebook, Instagram |
| Long copy | Article format | LinkedIn, Reddit |

## Platform Content Specs

| Platform | Format | Image Size | Video Spec | Copy Length |
|----------|--------|------------|------------|-------------|
| YouTube | Video | 16:9 thumbnail | Landscape 16:9 | Long OK |
| Instagram Feed | Carousel | 1:1 or 4:5 | 1:1 or 4:5 | 2200 chars |
| Instagram Reels | Video | - | 9:16 portrait | Short |
| Twitter | Image/video | 16:9 | 16:9 | 280 chars |
| LinkedIn | Image/video | 1.91:1 | Landscape | 3000 chars |
| Facebook | Image/video | Various | Various | Long OK |
| Reddit | Image + text | No limit | No limit | Title short |
| Threads | Image/text | Various | Various | 500 chars |

---

*Related: [Architecture](./01-architecture.md) | [Brand Config](./03-brand-config.md)*
