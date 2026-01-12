# Brand Configuration

## Brand Profile Data Model

### Overview

BrandProfile is the central configuration entity that controls how AI generates content. It consists of four main sections:

1. **Brand Identity (Visual)** - Logo, colors, visual style
2. **Brand Voice (Tone & Language)** - Personality, tone, language rules
3. **Brand Context (Custom Instructions)** - Free-form user instructions
4. **Platform Settings** - Per-platform overrides

## Brand Identity (Visual)

Visual branding elements used for generated images and content styling.

```typescript
BrandProfile {
  // Visual Assets
  logo: string               // R2 URL
  icon: string               // R2 URL (favicon-style)

  // Color Palette
  colors: {
    primary: string          // "#6366F1"
    secondary: string        // "#EC4899"
    accent: string           // "#10B981"
    background: string       // "#FFFFFF"
    text: string             // "#1F2937"
  }

  // Style Preferences
  visualStyle: 'minimal' | 'bold' | 'playful' | 'corporate' | 'luxury' | 'tech'
  fontPreference: 'modern' | 'classic' | 'handwritten' | 'monospace'
}
```

## Brand Voice (Tone & Language)

Controls how AI writes content - the personality, word choices, and style.

```typescript
BrandProfile {
  // Core Voice
  tone: string[]             // ["witty", "confident", "friendly"]
  personality: string        // "A smart friend who simplifies tech"

  // Language Rules
  languageRules: {
    wordsToUse: string[]     // ["ship", "build", "craft"]
    wordsToAvoid: string[]   // ["synergy", "leverage", "excited"]
    emojiUsage: 'none' | 'minimal' | 'moderate' | 'heavy'
    hashtagStyle: 'none' | 'minimal' | 'moderate' | 'heavy'
    ctaStyle: 'none' | 'soft' | 'direct'
  }

  // Example Posts (Few-shot learning)
  examplePosts: Array<{
    platform: Platform
    content: string
  }>
}
```

### Tone Options

| Tone | Description |
|------|-------------|
| `witty` | Clever, humorous observations |
| `confident` | Authoritative, assured |
| `friendly` | Warm, approachable |
| `professional` | Formal, business-appropriate |
| `casual` | Relaxed, conversational |
| `inspirational` | Motivating, uplifting |
| `educational` | Informative, teaching |
| `playful` | Fun, lighthearted |

### Emoji Usage Guidelines

| Setting | Description | Example |
|---------|-------------|---------|
| `none` | No emojis ever | "Check out our new product" |
| `minimal` | 0-1 per post | "New product launch! 🚀" |
| `moderate` | 2-3 per post | "🎉 New product launch! Check it out 👇" |
| `heavy` | 4+ per post | "🎉🚀 NEW PRODUCT! 💥 Check it out! 👇👀" |

### Hashtag Style Guidelines

| Setting | Description | Example |
|---------|-------------|---------|
| `none` | No hashtags | "Check out our new product" |
| `minimal` | 1-2 hashtags | "#newproduct" |
| `moderate` | 3-5 hashtags | "#newproduct #launch #tech #innovation" |
| `heavy` | 6+ hashtags | "#newproduct #launch #tech #innovation #startup #software #saas" |

## Brand Context (Custom Instructions)

Free-form text field where users can write any instructions. This is injected verbatim into AI prompts.

```typescript
BrandProfile {
  // Free-form instructions
  customContext: string
  // Example:
  // "We're a B2B SaaS for HR teams. Always mention free trial.
  //  Never mention competitors. Our differentiator is speed.
  //  Target mid-market companies (100-500 employees).
  //  Emphasize ROI and time savings."

  // Target Audience
  targetAudience: string     // "HR managers at mid-size companies"

  // Content Pillars (distribution %)
  contentPillars: Array<{
    name: string             // "Product Updates"
    percentage: number       // 40
  }>
}
```

### Content Pillars Example

```typescript
contentPillars: [
  { name: "Product Updates", percentage: 40 },
  { name: "Tips & Guides", percentage: 35 },
  { name: "Culture", percentage: 25 }
]
```

The autopilot scheduler uses these percentages to balance content mix over time.

## Platform Settings (Per-platform Overrides)

Each platform can have specific overrides for tone, context, and defaults.

```typescript
BrandProfile {
  platformSettings: {
    [platform: Platform]: {
      enabled: boolean
      toneOverride?: string[]           // Override main tone
      customContextOverride?: string    // Platform-specific instructions
      hashtagsDefault?: string[]        // Default hashtags
    }
  }
}

type Platform = 'TWITTER' | 'LINKEDIN' | 'FACEBOOK' | 'INSTAGRAM' | 'THREADS'
```

### Platform Override Example

```typescript
platformSettings: {
  TWITTER: {
    enabled: true,
    toneOverride: ["witty", "casual"],
    customContextOverride: "Keep tweets punchy. Use 1-2 hashtags max.",
    hashtagsDefault: ["buildinpublic"]
  },
  LINKEDIN: {
    enabled: true,
    toneOverride: ["professional", "educational"],
    customContextOverride: "Add industry insights. Longer form OK.",
    hashtagsDefault: ["HR", "HRTech", "PeopleOperations"]
  },
  INSTAGRAM: {
    enabled: false
  }
}
```

## Complete Configuration Example

```yaml
brand_profile:
  # Identity
  name: "OMECA"
  logo: "https://r2.24rabbit.ai/brands/omeca/logo.png"
  icon: "https://r2.24rabbit.ai/brands/omeca/icon.png"
  colors:
    primary: "#2563EB"
    secondary: "#7C3AED"
    accent: "#10B981"
    background: "#FFFFFF"
    text: "#1F2937"
  visualStyle: "corporate"
  fontPreference: "modern"

  # Voice
  tone: ["professional", "reliable", "helpful"]
  personality: "Your trusted restaurant supply partner"
  languageRules:
    wordsToUse: ["quality", "value", "professional"]
    wordsToAvoid: ["cheapest", "number one", "absolutely", "synergy"]
    emojiUsage: "minimal"
    hashtagStyle: "minimal"
    ctaStyle: "soft"

  # Examples (Few-shot)
  examplePosts:
    - platform: "TWITTER"
      content: "Upgrade your kitchen with OMECA's professional-grade cookware. Built for chefs who demand quality. Shop now at omeca.ca"
    - platform: "LINKEDIN"
      content: "Running a restaurant means making smart purchasing decisions every day. At OMECA, we understand that quality equipment isn't just an expense—it's an investment in your success.\n\nOur commercial cookware is designed for the demands of professional kitchens..."

  # Context
  customContext: |
    We're a B2B restaurant supply company based in Vancouver.
    Always mention "professional-grade" or "commercial quality".
    Target audience: restaurant owners, hotel procurement, F&B entrepreneurs.
    Never compare to competitors directly.
    Always include our website: omeca.ca
    Prices in CAD unless targeting US market.

  targetAudience: "Restaurant owners, hotel procurement managers, F&B entrepreneurs"

  contentPillars:
    - name: "Product Showcases"
      percentage: 40
    - name: "Industry Tips"
      percentage: 30
    - name: "Customer Success Stories"
      percentage: 20
    - name: "Company Updates"
      percentage: 10

  # Platform Overrides
  platformSettings:
    TWITTER:
      enabled: true
      customContextOverride: "Keep under 250 chars. Be punchy."
      hashtagsDefault: ["restaurantsupply", "commercialkitchen"]
    LINKEDIN:
      enabled: true
      toneOverride: ["professional", "educational"]
      customContextOverride: "Can be longer. Include industry insights."
      hashtagsDefault: ["FoodService", "HospitalityIndustry", "RestaurantBusiness"]
    FACEBOOK:
      enabled: true
      customContextOverride: "Can use more emojis. Casual OK."
    INSTAGRAM:
      enabled: false
    THREADS:
      enabled: false
```

## How AI Uses Configuration

```
When Generating Content
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Load Brand Configuration                        │
│  • Brand Identity → Visual generation           │
│  • Brand Voice → Tone and word choices          │
│  • Custom Context → Inject into system prompt   │
│  • Platform Settings → Apply overrides          │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Build AI Prompt                                 │
│  System Prompt = Personality + Voice + Context  │
│  + Platform Rules + Material + Instructions     │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Generate 3 Variations                           │
│  Each with different angle/hook                 │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Content Validation                              │
│  • Check wordsToAvoid - none present            │
│  • Check wordsToUse - required included         │
│  • Check emojiUsage - matches setting           │
│  • Check hashtagStyle - correct count           │
│  • Check length - within platform limits        │
│  • Failed → Regenerate that variation           │
└─────────────────────────────────────────────────┘
```

## Few-Shot Learning with Example Posts

The `examplePosts` field provides AI with concrete examples of ideal posts for each platform. This dramatically improves output quality.

**Best Practices:**
- Provide 2-3 examples per platform
- Include different content types (product, tip, announcement)
- Show your actual voice in action
- Update examples as your brand evolves

```typescript
examplePosts: [
  {
    platform: "TWITTER",
    content: "Ship faster, not harder. Our new CI/CD pipeline cut deployment time by 80% for @acmecorp. Here's how they did it 🧵"
  },
  {
    platform: "LINKEDIN",
    content: "DevOps isn't just about tools—it's about culture.\n\nAfter helping 50+ teams transform their deployment workflows, here are the 3 patterns that actually matter:\n\n1. Automate everything that doesn't require human judgment\n2. Make failures visible, not punishable\n3. Measure what matters, not what's easy\n\nThe teams that embrace these principles ship 10x faster.\n\nWhat patterns have you seen work? Drop a comment below."
  }
]
```

---

*Related: [AI Processing](./02-ai-processing.md) | [Approval Workflow](./08-approval-workflow.md)*
