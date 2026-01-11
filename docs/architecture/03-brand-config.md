# Brand Configuration

## Brand Profile

Users set up basic brand information. AI maintains content consistency based on this:

| Setting | Description | Example |
|---------|-------------|---------|
| Brand Name | Brand/company name | OMECA |
| Brand Tagline | One-line description | Professional restaurant supply provider |
| Target Audience | Who are the customers | Restaurant owners, hotel buyers |
| Brand Tone | Content style | Professional, reliable, premium |
| Core Selling Points | Product advantages | Wholesale prices, quality guarantee |
| Forbidden Words | Words to avoid | Cheapest, #1, absolutely |
| Competitor Info | Brands not to mention | [Competitor list] |

## Content Instructions

### General Instructions

```
Examples:
- Every post must include brand name "OMECA"
- Display prices in USD
- Add website link at the end
- Use no more than 3 emojis
- Keep tone professional but friendly, not too salesy
```

### Platform-Specific Instructions

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
- Put hashtags at the end
```

### Content Type Instructions

```
New Product Launch:
- Emphasize "new", "just arrived"
- Highlight product features
- Include limited-time offers

Daily Marketing:
- Share use cases
- Customer testimonials
- Industry tips

Promotional Campaign:
- Highlight discount amount
- Emphasize deadline
- Create urgency
```

## How AI Uses Configuration

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
│  • Check if length meets requirements            │
│  • Failed → Regenerate                           │
└─────────────────────────────────────────────────┘
```

## Configuration Example: OMECA

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

*Related: [AI Processing](./02-ai-processing.md) | [Approval Workflow](./08-approval-workflow.md)*
