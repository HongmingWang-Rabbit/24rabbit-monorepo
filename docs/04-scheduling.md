# Intelligent Scheduling System

## Content Source Priority

```
Priority 1: User-uploaded materials (unused)
    ↓
Priority 2: Relevant trending topics (if enabled)
    ↓
Priority 3: User-uploaded materials (used before)
    ↓
Priority 4: Unmarketed products from connected websites
    ↓
Priority 5: High-performing historical content (repackaged)
```

## Scheduling Logic

```
Scheduled trigger (user-defined Cron)
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
│  Step 2: Check Trending (if enabled)             │
│  Any relevant trending topics?                   │
│  ├── Yes → Generate trending content             │
│  └── No  → Go to Step 3                          │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Step 3: Crawl Connected Websites                │
│  Any unmarketed products?                        │
│  ├── Yes → Select one product                    │
│  └── No  → Go to Step 4                          │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Step 4: Reuse Historical Content                │
│  Select high-performing content, repackage       │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Step 5: Generate & Publish                      │
│  • AI generates content                          │
│  • Check approval settings                       │
│  • Publish to platforms (or queue for approval)  │
│  • Record to VectorDB                            │
│  • Update material status                        │
│  • Deduct credits                                │
└─────────────────────────────────────────────────┘
```

## Material Pool

### Material Types

| Type | Example | AI Processing |
|------|---------|---------------|
| Video | Product demo | Analyze → Screenshot → Generate |
| Image | Product photos | Analyze → Resize → Generate |
| Text | Product description | Understand → Optionally generate images |

### Material Status

- `unused` - Never used, highest priority
- `used_once` - Used once
- `used_multiple` - Used multiple times, lowest priority

## External Data Sources

| Platform | Integration |
|----------|-------------|
| Shopify | API integration |
| WooCommerce | API integration |
| Custom website | Web crawling (Firecrawl) |

### Crawling Logic

1. Traverse product catalog
2. Extract product info (name, price, images, description)
3. Generate embedding, compare with VectorDB
4. Filter out already-marketed products

## VectorDB Deduplication

**Purpose:** Avoid publishing duplicate/similar content

**How it works:**
1. Before each publish, generate embedding for the content
2. Compare similarity with existing content in VectorDB
3. Similarity > 0.9 → Duplicate, skip or regenerate
4. Similarity < 0.9 → Allow publish, record to VectorDB

## Schedule Configuration

Users can define custom Cron expressions:

```yaml
schedule:
  cronExpression: "0 9 * * *"     # Daily at 9am
  timezone: "America/Vancouver"
  platforms: ["facebook", "twitter", "linkedin"]
  contentSource: "auto"           # auto | material_only | trending_only
  isActive: true
```

### Common Cron Examples

| Schedule | Cron Expression |
|----------|-----------------|
| Daily 9am | `0 9 * * *` |
| Twice daily (9am, 5pm) | `0 9,17 * * *` |
| Every 8 hours | `0 */8 * * *` |
| Weekdays only 10am | `0 10 * * 1-5` |
| Every Monday 9am | `0 9 * * 1` |

---

*Related: [AI Processing](./02-ai-processing.md) | [Trending](./09-trending.md)*
