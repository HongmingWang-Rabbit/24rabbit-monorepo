# Intelligent Scheduling System

## Content Planning (Autopilot Mode)

The autopilot scheduler runs as a cron job every 5 minutes, checking for schedules that need execution.

### Autopilot Flow

```
[Cron Trigger (every 5 min)]
        │
        ▼
┌─────────────────────────────────────┐
│ CHECK SCHEDULES                     │
├─────────────────────────────────────┤
│ Query: SELECT * FROM schedules      │
│ WHERE isActive = true               │
│ AND nextRunAt <= NOW()              │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ LOAD SCHEDULE CONFIG                │
├─────────────────────────────────────┤
│ Schedule {                          │
│   brandProfileId                    │
│   platforms: ["twitter", "linkedin"]│
│   frequency: "2_per_day"            │
│   times: ["09:00", "17:00"]         │
│   timezone: "America/Vancouver"     │
│   autoApprove: true                 │
│   materialStrategy: "round_robin"   │
│   uniquePerPlatform: false          │
│ }                                   │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ SELECT MATERIAL                     │
├─────────────────────────────────────┤
│ Strategies:                         │
│ • round_robin: use each once        │
│ • random: pick randomly from pool   │
│ • weighted: favor high-value items  │
│ • pillar_balanced: match content    │
│   pillars percentage                │
│                                     │
│ Filter:                             │
│ • status = READY                    │
│ • not used in last X days           │
│ • matches content pillar if set     │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ SIMILARITY CHECK (pgvector)         │
├─────────────────────────────────────┤
│ Query:                              │
│ SELECT * FROM content_embeddings    │
│ WHERE user_id = $1                  │
│ AND created_at > NOW() - 30 days    │
│ ORDER BY embedding <=> $2           │
│ LIMIT 5                             │
│                                     │
│ If similarity > 0.85:               │
│ → Skip material, pick another       │
│ → Or select different angle         │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ QUEUE GENERATION JOB                │
├─────────────────────────────────────┤
│ Redis Queue: content:generate       │
│                                     │
│ Job payload: {                      │
│   materialId                        │
│   brandProfileId                    │
│   platforms: ["twitter", "linkedin"]│
│   mode: "autopilot"                 │
│   scheduledFor: "2025-01-10T17:00Z" │
│   autoApprove: true                 │
│   uniquePerPlatform: false          │
│ }                                   │
└─────────────────────────────────────┘
```

## Material Selection Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| `round_robin` | Use each material once before reusing | Even coverage of all content |
| `random` | Random selection from available pool | Variety, unpredictability |
| `weighted` | Favor high-engagement materials | Maximize performance |
| `pillar_balanced` | Match content pillar percentages | Maintaining content mix |

### Pillar-Balanced Strategy

When using `pillar_balanced`, the scheduler tracks how many posts have been made for each content pillar and selects materials to maintain the configured percentages:

```typescript
contentPillars: [
  { name: "Product Updates", percentage: 40 },
  { name: "Tips & Guides", percentage: 35 },
  { name: "Culture", percentage: 25 }
]

// If recent 10 posts are:
// - Product Updates: 6 (60%) ← over target
// - Tips & Guides: 2 (20%) ← under target
// - Culture: 2 (20%) ← under target

// Next selection will prioritize: Tips & Guides
```

## Schedule Configuration

### Schedule Entity

```typescript
Schedule {
  id: string
  brandProfileId: string          // FK → BrandProfile
  platforms: Platform[]           // ["TWITTER", "LINKEDIN"]
  frequency: Frequency            // "2_per_day"
  times: string[]                 // ["09:00", "17:00"]
  timezone: string                // "America/Vancouver"
  daysOfWeek: number[]            // [1,2,3,4,5] (Mon-Fri)
  materialStrategy: MaterialStrategy
  autoApprove: boolean            // Skip manual review
  uniquePerPlatform: boolean      // Generate unique content per platform
  isActive: boolean
  nextRunAt: Date
  createdAt: Date
  updatedAt: Date
}

type Frequency = '1_per_day' | '2_per_day' | '3_per_day' | 'weekly' | 'custom'
type MaterialStrategy = 'round_robin' | 'random' | 'weighted' | 'pillar_balanced'
```

### Frequency Options

| Frequency | Description | Times |
|-----------|-------------|-------|
| `1_per_day` | Once daily | User sets 1 time |
| `2_per_day` | Twice daily | User sets 2 times |
| `3_per_day` | Three times daily | User sets 3 times |
| `weekly` | Once per week | User sets day and time |
| `custom` | Custom schedule | User sets multiple times |

### Example Configuration

```yaml
schedule:
  brandProfileId: "bp_123"
  platforms: ["TWITTER", "LINKEDIN", "FACEBOOK"]
  frequency: "2_per_day"
  times: ["09:00", "17:00"]
  timezone: "America/Vancouver"
  daysOfWeek: [1, 2, 3, 4, 5]    # Weekdays only
  materialStrategy: "pillar_balanced"
  autoApprove: true
  uniquePerPlatform: false
  isActive: true
```

## Content Source Priority

When the scheduler needs to select content:

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

## VectorDB Deduplication

**Purpose:** Avoid publishing duplicate or similar content.

### How it Works

1. Before selecting material, generate embedding for candidate content
2. Compare similarity with existing content in VectorDB
3. Apply threshold rules:

```
Similarity scores:
0.0 - 0.5  → Unique ✓ (proceed)
0.5 - 0.7  → Different enough ✓ (proceed)
0.7 - 0.85 → Similar ⚠ (proceed with caution)
0.85 - 1.0 → Too similar ✗ (skip, pick another material)
```

### Similarity Query

```sql
SELECT * FROM content_embeddings
WHERE user_id = $1
AND created_at > NOW() - INTERVAL '30 days'
ORDER BY embedding <=> $2
LIMIT 5
```

The `<=>` operator is pgvector's cosine distance function.

## Material Pool

### Material Types

| Type | Example | AI Processing |
|------|---------|---------------|
| Text | Notes, descriptions | Understand → Generate |
| URL | Blog posts, articles | Scrape → Analyze → Generate |
| File | PDF, DOCX, TXT | Parse → Analyze → Generate |
| Image | Product photos | Analyze → Resize → Generate |
| Video | Product demo | Analyze → Screenshot → Generate |

### Material Status Flow

```
UPLOADED → PROCESSING → ANALYZED → READY → USED
                                        ↓
                                    (reusable after cooldown)
```

### Status Definitions

| Status | Description |
|--------|-------------|
| `UPLOADED` | Just uploaded, pending processing |
| `PROCESSING` | Being analyzed by AI |
| `ANALYZED` | Analysis complete, pending embedding |
| `READY` | Ready for content generation |
| `USED` | Used in at least one post |
| `ARCHIVED` | User archived, won't be selected |

## Publishing Worker

After content is generated and approved, the publishing worker handles the actual posting.

### Publishing Flow

```
[Job: post:publish]
        │
        ▼
┌─────────────────────────────────────┐
│ LOAD POST DATA                      │
├─────────────────────────────────────┤
│ • PendingPost record                │
│ • SocialAccount credentials         │
│ • Platform API config               │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ RATE LIMIT CHECK                    │
├─────────────────────────────────────┤
│ Redis: INCR ratelimit:{platform}    │
│                                     │
│ Platform limits:                    │
│ • Twitter: 50 posts/day             │
│ • LinkedIn: 100 posts/day           │
│ • Facebook: 50 posts/day            │
│                                     │
│ If exceeded: delay job, re-queue    │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ CALL PLATFORM API                   │
├─────────────────────────────────────┤
│ Platform Connectors:                │
│ • TwitterConnector.publish(post)    │
│ • LinkedInConnector.publish(post)   │
│ • FacebookConnector.publish(post)   │
│ • InstagramConnector.publish(post)  │
│ • ThreadsConnector.publish(post)    │
│                                     │
│ Each connector handles:             │
│ • OAuth token refresh               │
│ • Media upload (if images/video)    │
│ • API call with content             │
│ • Error handling                    │
└─────────────────────────────────────┘
        │
        ├── SUCCESS ──────────────────────┐
        │                                 │
        ▼                                 ▼
┌─────────────────────┐    ┌─────────────────────┐
│ ON SUCCESS          │    │ ON FAILURE          │
├─────────────────────┤    ├─────────────────────┤
│ Create Post record: │    │ Retry logic:        │
│ • externalId        │    │ • Attempt 1: wait 1s│
│ • publishedAt       │    │ • Attempt 2: wait 5s│
│ • platform          │    │ • Attempt 3: wait 30s│
│ • content           │    │                     │
│                     │    │ After 3 fails:      │
│ Update PendingPost: │    │ • Status = FAILED   │
│ • status = PUBLISHED│    │ • Log error         │
│                     │    │ • Notify user       │
│ Store embedding for │    │ • Dead letter queue │
│ future similarity   │    │                     │
└─────────────────────┘    └─────────────────────┘
```

## Analytics Collection

Metrics are collected hourly for published posts.

### Analytics Flow

```
[Hourly Cron]
        │
        ▼
┌─────────────────────────────────────┐
│ GET POSTS TO UPDATE                 │
├─────────────────────────────────────┤
│ SELECT * FROM posts                 │
│ WHERE publishedAt > NOW() - 7 days  │
│ AND platform IN (connected accounts)│
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ FETCH METRICS FROM PLATFORMS        │
├─────────────────────────────────────┤
│ For each post:                      │
│ • Call platform API                 │
│ • Get: likes, comments, shares,     │
│   impressions, reach, clicks        │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ UPDATE DATABASE                     │
├─────────────────────────────────────┤
│ Post record:                        │
│ • likes, comments, shares           │
│ • impressions, reach                │
│                                     │
│ AnalyticsSnapshot:                  │
│ • Daily rollup per account          │
│ • followers, engagement rate        │
└─────────────────────────────────────┘
```

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

---

*Related: [AI Processing](./02-ai-processing.md) | [Trending](./09-trending.md)*
