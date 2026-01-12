# Content Generation Behavior

This document describes how agents generate content, including decision logic, Brand Profile context injection, validation rules, and similarity checking.

## Generation Triggers

Content generation can be triggered by:

| Trigger | Source | Description |
|---------|--------|-------------|
| Schedule | Scheduler Cron | Automated 24/7 content based on schedule configuration |
| Manual | API Request | User explicitly requests content for specific material |
| Regenerate | Approval UI | User requests new variations for pending content |

## Generation Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTENT GENERATION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. TRIGGER                                                      │
│     Schedule cron / Manual request / Regenerate                  │
│                           │                                       │
│                           ▼                                       │
│  2. MATERIAL SELECTION (if scheduled)                            │
│     Apply selection strategy                                      │
│     Check material availability                                   │
│                           │                                       │
│                           ▼                                       │
│  3. PRE-GENERATION SIMILARITY CHECK                              │
│     Compare material embedding against recent posts               │
│     Score > 0.85? → Skip, select different material              │
│                           │                                       │
│                           ▼                                       │
│  4. LOAD CONTEXT                                                 │
│     Material (content, summary, keyPoints, angles)               │
│     Brand Profile (full configuration)                           │
│     Recent Posts (for diversity)                                 │
│     Platform Rules (limits, best practices)                      │
│                           │                                       │
│                           ▼                                       │
│  5. BUILD AI PROMPT                                              │
│     Inject Brand Profile context                                 │
│     Include few-shot examples                                    │
│     Specify platform constraints                                 │
│                           │                                       │
│                           ▼                                       │
│  6. CALL AI ADAPTER                                              │
│     Generate 3 variations                                        │
│     Each with different angle/hook                               │
│                           │                                       │
│                           ▼                                       │
│  7. VALIDATE OUTPUT                                              │
│     Character limits                                             │
│     Banned words check                                           │
│     Required words check                                         │
│     JSON structure validation                                    │
│                           │                                       │
│                           ▼                                       │
│  8. POST-GENERATION SIMILARITY CHECK                             │
│     Check each variation against recent posts                    │
│     Regenerate if too similar                                    │
│                           │                                       │
│                           ▼                                       │
│  9. PLATFORM ADAPTATION (if multi-platform)                      │
│     Adapt content for each target platform                       │
│     Apply platform-specific overrides                            │
│                           │                                       │
│                           ▼                                       │
│  10. CREATE PENDING POST                                         │
│      Store 3 variations                                          │
│      Set status (PENDING or AUTO_APPROVED)                       │
│      Generate and store embedding                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Material Selection

When triggered by a schedule, the agent must select which material to use.

### Selection Strategies

| Strategy | Behavior |
|----------|----------|
| `round_robin` | Use each material once before reusing any. Ensures equal distribution. |
| `random` | Random selection from available materials. Good for variety. |
| `weighted` | Favor materials with higher historical engagement. Optimizes performance. |
| `pillar_balanced` | Maintain content pillar percentages defined in Brand Profile. |

### Pillar-Balanced Selection

```typescript
// Brand Profile defines target percentages
contentPillars: [
  { name: "Product Updates", percentage: 40 },
  { name: "Tips & Guides", percentage: 35 },
  { name: "Company Culture", percentage: 25 }
]

// Agent tracks actual distribution over rolling 30-day window
// Selects material from under-represented pillar
```

### Material Availability Rules

A material is available for selection when:

1. Status is `READY` (analysis complete)
2. Not used within cooldown period (configurable, default 7 days)
3. Matches target content pillar (if pillar_balanced strategy)
4. Not flagged as exhausted

## Context Loading

Before generating content, the agent loads comprehensive context:

### Material Context

```typescript
interface MaterialContext {
  content: string           // Original content
  summary: string           // AI-generated summary
  keyPoints: string[]       // Extracted key points
  keywords: string[]        // Relevant keywords
  suggestedAngles: string[] // AI-suggested content angles
  contentType: string       // Article, product, announcement, etc.
  sentiment: string         // Positive, neutral, informative, etc.
}
```

### Brand Profile Context

The complete Brand Profile is loaded and injected into the AI prompt:

```typescript
interface BrandProfileContext {
  // Identity
  name: string
  customContext: string     // User's instructions (INJECTED VERBATIM)
  targetAudience: string

  // Voice Configuration
  personality: string       // e.g., "Friendly, professional, innovative"
  tone: string[]           // e.g., ["conversational", "enthusiastic"]

  // Language Rules
  languageRules: {
    wordsToUse: string[]    // Encouraged vocabulary
    wordsToAvoid: string[]  // Banned vocabulary
    emojiUsage: 'none' | 'minimal' | 'moderate' | 'heavy'
    hashtagStyle: 'none' | 'minimal' | 'moderate' | 'heavy'
    ctaStyle: string        // e.g., "soft suggestion" or "direct action"
  }

  // Learning Examples
  examplePosts: string[]    // Few-shot learning samples

  // Platform Overrides
  platformSettings: {
    [platform: string]: {
      toneOverride?: string[]
      additionalContext?: string
    }
  }
}
```

### Recent Posts Context

Last 20 published posts are loaded to:
- Avoid repeating similar content
- Maintain voice consistency
- Provide additional context to AI

### Platform Rules

```typescript
interface PlatformRules {
  platform: string
  maxCharacters: number
  maxImages: number
  maxVideos: number
  hashtagRecommendation: string
  bestPractices: string[]
}
```

## AI Prompt Construction

The agent builds a structured prompt for the AI Adapter:

```
SYSTEM: You are a social media content creator for {brand.name}

═══════════════════════════════════════════════════════════════
BRAND CONTEXT
═══════════════════════════════════════════════════════════════
{brand.customContext}
← User's exact instructions, injected without modification

═══════════════════════════════════════════════════════════════
TARGET AUDIENCE
═══════════════════════════════════════════════════════════════
{brand.targetAudience}

═══════════════════════════════════════════════════════════════
VOICE & TONE
═══════════════════════════════════════════════════════════════
Personality: {brand.personality}
Tone: {brand.tone.join(', ')}

Language Rules:
- Words to USE: {brand.languageRules.wordsToUse.join(', ')}
- Words to AVOID: {brand.languageRules.wordsToAvoid.join(', ')}
- Emoji usage: {brand.languageRules.emojiUsage}
- Hashtag style: {brand.languageRules.hashtagStyle}
- CTA style: {brand.languageRules.ctaStyle}

═══════════════════════════════════════════════════════════════
EXAMPLE POSTS (Learn from these)
═══════════════════════════════════════════════════════════════
{brand.examplePosts.map((post, i) => `Example ${i+1}: ${post}`).join('\n')}

═══════════════════════════════════════════════════════════════
PLATFORM RULES
═══════════════════════════════════════════════════════════════
Platform: {platform}
Character limit: {platformRules.maxCharacters}
{platformRules.bestPractices.join('\n')}

═══════════════════════════════════════════════════════════════
RECENT POSTS (Avoid similarity)
═══════════════════════════════════════════════════════════════
{recentPosts.slice(0, 10).map(p => `- ${p.content.slice(0, 100)}...`).join('\n')}

═══════════════════════════════════════════════════════════════
SOURCE MATERIAL
═══════════════════════════════════════════════════════════════
Content: {material.content}

Key Points:
{material.keyPoints.map(kp => `- ${kp}`).join('\n')}

Suggested Angles:
{material.suggestedAngles.map(a => `- ${a}`).join('\n')}

═══════════════════════════════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════════════════════════════
Generate exactly 3 unique variations for {platform}.

Requirements:
1. Each variation must use a DIFFERENT angle or hook
2. Match the brand voice and personality exactly
3. Stay within the {platformRules.maxCharacters} character limit
4. Follow all language rules (use/avoid words, emoji style)
5. Content must be ready to publish (no placeholders like [PRODUCT])
6. Include appropriate hashtags per the hashtag style

Respond in this JSON format:
{
  "variations": [
    {
      "content": "The full post text",
      "angle": "Brief description of the angle used",
      "hashtags": ["tag1", "tag2"],
      "characterCount": 150
    }
  ]
}
```

## AI Adapter Call

The prompt is sent to the configured AI Adapter:

```typescript
interface AIAdapter {
  generateCopy(params: GenerateCopyParams): Promise<GeneratedCopy>
}

interface GenerateCopyParams {
  prompt: string
  platform: string
  maxTokens: number
  temperature: number  // 0.7-0.9 for creative variation
}

interface GeneratedCopy {
  variations: ContentVariation[]
}

interface ContentVariation {
  content: string
  angle: string
  hashtags: string[]
  characterCount: number
}
```

**Provider Configuration**:
- Default: Gemini 1.5 Pro (or Flash for faster execution)
- Temperature: 0.8 (creative but consistent)
- Output format: JSON

The AI Adapter interface allows swapping providers without changing agent logic.

## Validation Rules

Each generated variation is validated before acceptance:

### Character Limit Validation

```typescript
function validateCharacterLimit(content: string, platform: Platform): boolean {
  const limits = {
    TWITTER: 280,
    FACEBOOK: 63206,
    LINKEDIN: 3000,
    INSTAGRAM: 2200
  }
  return content.length <= limits[platform]
}
```

### Banned Words Check

```typescript
function validateBannedWords(content: string, bannedWords: string[]): ValidationResult {
  const lowerContent = content.toLowerCase()
  const violations = bannedWords.filter(word =>
    lowerContent.includes(word.toLowerCase())
  )
  return {
    valid: violations.length === 0,
    violations
  }
}
```

### Required Words Check

```typescript
function validateRequiredWords(content: string, requiredWords: string[]): ValidationResult {
  const lowerContent = content.toLowerCase()
  const missing = requiredWords.filter(word =>
    !lowerContent.includes(word.toLowerCase())
  )
  return {
    valid: missing.length === 0,
    missing
  }
}
```

### Structure Validation

- Valid JSON response
- Exactly 3 variations
- Each variation has required fields
- No placeholder text (e.g., `[PRODUCT]`, `[BRAND]`, `{{name}}`)

### Validation Failure Handling

If a variation fails validation:

1. Log the specific failure reason
2. Request regeneration of that specific variation
3. Maximum 3 regeneration attempts per variation
4. If all attempts fail, return fewer variations (minimum 1 required)

## Similarity Checking

Similarity checking prevents repetitive content using pgvector embeddings.

### Pre-Generation Check

Before generating content, check if the source material is too similar to recent posts:

```typescript
async function preGenerationSimilarityCheck(
  materialEmbedding: number[],
  brandProfileId: string
): Promise<{ proceed: boolean; reason?: string }> {
  // Query recent posts (last 30 days)
  const similarPosts = await prisma.$queryRaw`
    SELECT content, 1 - (embedding <=> ${materialEmbedding}::vector) as similarity
    FROM content_embeddings
    WHERE brand_profile_id = ${brandProfileId}
      AND created_at > NOW() - INTERVAL '30 days'
    ORDER BY embedding <=> ${materialEmbedding}::vector
    LIMIT 1
  `

  if (similarPosts[0]?.similarity > 0.85) {
    return {
      proceed: false,
      reason: `Material too similar to recent post (${similarPosts[0].similarity.toFixed(2)})`
    }
  }

  return { proceed: true }
}
```

### Post-Generation Check

After generating variations, check each against recent posts:

```typescript
async function postGenerationSimilarityCheck(
  variation: ContentVariation,
  brandProfileId: string
): Promise<{ unique: boolean; similarity: number }> {
  // Generate embedding for the variation
  const embedding = await aiAdapter.generateEmbedding(variation.content)

  // Check against recent posts
  const result = await prisma.$queryRaw`
    SELECT MAX(1 - (embedding <=> ${embedding}::vector)) as max_similarity
    FROM content_embeddings
    WHERE brand_profile_id = ${brandProfileId}
      AND created_at > NOW() - INTERVAL '30 days'
  `

  return {
    unique: result.max_similarity < 0.85,
    similarity: result.max_similarity
  }
}
```

### Similarity Thresholds

| Score | Classification | Action |
|-------|---------------|--------|
| 0.0 - 0.70 | Unique | Accept variation |
| 0.70 - 0.85 | Somewhat similar | Accept with warning logged |
| 0.85 - 1.0 | Too similar | Reject, regenerate |

## Platform Adaptation

When generating for multiple platforms, content can be adapted:

### Unique Per Platform Mode

If `schedule.uniquePerPlatform = true`:
- Run full generation for each platform separately
- Each platform gets its own 3 variations
- Maximum diversity but higher AI cost

### Adapted Mode (Default)

If `schedule.uniquePerPlatform = false`:
- Generate primary content for first platform
- Adapt winning variation for other platforms

```typescript
async function adaptForPlatform(
  content: string,
  sourcePlatform: Platform,
  targetPlatform: Platform,
  brandProfile: BrandProfile
): Promise<string> {
  // Apply platform-specific tone override
  const toneOverride = brandProfile.platformSettings[targetPlatform]?.toneOverride

  // Adjust length for platform limits
  const targetLimit = PLATFORM_LIMITS[targetPlatform].maxChars

  // Call AI to adapt
  return await aiAdapter.generateCopy({
    prompt: `Adapt this ${sourcePlatform} post for ${targetPlatform}.
             Original: ${content}
             Target character limit: ${targetLimit}
             ${toneOverride ? `Tone adjustment: ${toneOverride}` : ''}
             Maintain brand voice and key message.`,
    platform: targetPlatform,
    maxTokens: 500,
    temperature: 0.5  // Lower temperature for adaptation
  })
}
```

### Platform-Specific Adjustments

| From → To | Adjustments |
|-----------|-------------|
| Twitter → LinkedIn | Expand with professional context, add detail |
| LinkedIn → Twitter | Compress to hook + CTA, aggressive trimming |
| Any → Instagram | Ensure visual-first language, adjust hashtags |
| Any → Facebook | Conversational expansion, add engagement question |

## Output: PendingPost Creation

After successful generation, a PendingPost is created:

```typescript
const pendingPost = await prisma.pendingPost.create({
  data: {
    userId: brandProfile.userId,
    brandProfileId: brandProfile.id,
    materialId: material.id,
    platform: platform,

    // Store all 3 variations
    variations: variations,
    selectedVariation: 0,           // Default to first
    finalContent: variations[0].content,

    // Scheduling
    scheduledFor: calculateScheduledTime(schedule),

    // Generation metadata
    generationMode: trigger === 'schedule' ? 'autopilot' : 'manual',

    // Status based on approval settings
    status: schedule.autoApprove ? 'AUTO_APPROVED' : 'PENDING',

    // Embedding for future similarity checks
    embedding: await aiAdapter.generateEmbedding(variations[0].content)
  }
})
```

## Credit Consumption

Content generation consumes credits based on operation type:

| Operation | Credit Cost |
|-----------|-------------|
| Text generation (3 variations) | 1 credit |
| Image analysis | 2 credits |
| Video analysis | 5 credits |
| Publishing | 1 credit per platform |

Credits are deducted before generation begins. If generation fails, credits are refunded.

## Performance Considerations

### Caching

- Brand Profile context cached per request (loaded once, used for all platforms)
- Platform rules cached in memory (rarely change)
- Recent posts query optimized with proper indexing

### Batching

- When generating for multiple platforms, parallelize independent operations
- Similarity checks can run in parallel for each variation

### Timeouts

- AI generation timeout: 60 seconds per variation
- Total generation timeout: 5 minutes per job
- Exceeded timeout triggers retry with exponential backoff
