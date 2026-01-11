# AI Processing Workflows

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

---

*Related: [Architecture](./01-architecture.md) | [Brand Config](./03-brand-config.md)*
