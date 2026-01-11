# Trending Integration

## Trending Sources

### MVP (Phase 1): Gemini Search

- Simple implementation
- Leverage Gemini's built-in web search
- Sufficient for basic trending awareness

```typescript
// Example Gemini prompt
const prompt = `
What are the current trending topics in the ${industry} industry?
Focus on topics that a ${brandType} could create relevant content about.
Return top 5 topics with relevance scores.
`;
```

### Future (Phase 2+): Dedicated APIs

| Source | Use Case |
|--------|----------|
| Google Trends API | General trend data |
| Twitter/X Trending | Real-time social trends |
| Reddit Rising | Community discussions |
| Platform-specific | Each platform's trending |

## Trending Workflow

```
Trending Content Generation (2 Credits)
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Step 1: Fetch Trending Topics                   │
│  • Query Gemini: "What's trending in [industry]?"│
│  • Filter by user's brand/industry settings      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Step 2: Relevance Check                         │
│  • Is this trend relevant to user's brand?       │
│  • Is it appropriate/safe to engage?             │
│  • Score: High/Medium/Low relevance              │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Step 3: Content Generation                      │
│  • Generate content connecting trend + brand     │
│  • Maintain brand voice and guidelines           │
│  • Add relevant hashtags                         │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
                Publish / Approval Queue
```

## Relevance Scoring

```typescript
interface TrendingTopic {
  topic: string;
  description: string;
  relevanceScore: number;  // 0-100
  safetyScore: number;     // 0-100
  suggestedAngle: string;
}

// Scoring criteria
const relevanceCriteria = {
  industryMatch: 30,      // Does it relate to user's industry?
  audienceMatch: 25,      // Does it interest target audience?
  brandFit: 25,           // Can brand naturally engage?
  timeliness: 20          // Is it still trending?
};

// Safety criteria
const safetyCriteria = {
  notPolitical: true,
  notControversial: true,
  notSensitive: true,
  brandSafe: true
};
```

## Content Source Priority (Updated)

```
Priority 1: User-uploaded materials (unused)
    ↓
Priority 2: 🔥 Relevant trending topics (if enabled)
    ↓
Priority 3: User-uploaded materials (used before)
    ↓
Priority 4: Unmarketed products from connected websites
    ↓
Priority 5: High-performing historical content (repackaged)
```

## Trending Settings

```typescript
BrandProfile {
  // Trending settings
  trendingEnabled: boolean        // Enable/disable trending
  trendingPriority: 'high' | 'medium' | 'low'
  trendingFilters: {
    industries: string[]          // Relevant industries
    excludeTopics: string[]       // Topics to avoid
    minRelevance: number          // Minimum relevance score
    requireApproval: boolean      // Always require approval for trending
  }
}
```

## Example: OMECA Trending Post

```
Trending Topic: "Restaurant industry recovery post-COVID"
Relevance Score: 85/100

Generated Content:
┌─────────────────────────────────────────────────┐
│  "餐饮业复苏正在加速！OMECA 专为复苏中的餐厅    │
│   提供高品质、优价格的设备。从餐具到厨具，      │
│   我们助您重新出发。                            │
│                                                 │
│   #餐饮复苏 #OMECA #餐厅设备"                   │
└─────────────────────────────────────────────────┘
```

## Credit Cost

| Action | Credits |
|--------|---------|
| Trending analysis only | 1 |
| Trending + content generation | 2 |
| Regular content generation | 1 |

---

*Related: [Scheduling](./04-scheduling.md) | [AI Processing](./02-ai-processing.md)*
