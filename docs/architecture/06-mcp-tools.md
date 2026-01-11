# MCP Tool Interface

## MCP Architecture

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

## Tool Categories

### Material Management

| Tool | Function | Parameters |
|------|----------|------------|
| `upload_material` | Upload material to pool | `type`, `file`, `tags` |
| `get_material_pool` | Get material pool status | `brandProfileId`, `status` |
| `update_material_status` | Update usage status | `materialId`, `status` |

### External Data Sources

| Tool | Function | Parameters |
|------|----------|------------|
| `bind_external_source` | Connect e-commerce site | `type`, `config` |
| `crawl_external_source` | Crawl product list | `sourceId` |
| `get_unmarked_products` | Get unmarketed products | `sourceId`, `limit` |

### Content Processing

| Tool | Function | Parameters |
|------|----------|------------|
| `analyze_content` | Analyze video/image/text | `type`, `content` |
| `extract_frames` | Video screenshots | `videoUrl`, `timestamps` |
| `optimize_image` | Platform sizing | `imageUrl`, `platforms` |
| `generate_image` | AI generate images | `prompt`, `style` |
| `generate_copy` | Generate platform copy | `input`, `platforms`, `brandProfile` |

### Publishing Management

| Tool | Function | Parameters |
|------|----------|------------|
| `post_content` | Single platform publish | `platform`, `content`, `media` |
| `schedule_post` | Scheduled publish | `platform`, `content`, `scheduledAt` |
| `cross_post` | Multi-platform publish | `platforms[]`, `content` |

### Intelligent Scheduling

| Tool | Function | Parameters |
|------|----------|------------|
| `trigger_publish` | Manually trigger | `brandProfileId` |
| `preview_next_publish` | Preview next content | `brandProfileId` |
| `check_content_similarity` | VectorDB dedup check | `content`, `threshold` |

### Analytics

| Tool | Function | Parameters |
|------|----------|------------|
| `get_analytics` | Get post performance | `platform`, `dateRange` |
| `get_trending` | Get trending topics | `platform`, `category` |

## Tool Schemas

### post_content

```typescript
{
  name: "post_content",
  description: "Publish content to a social media platform",
  parameters: {
    platform: {
      type: "string",
      enum: ["facebook", "twitter", "linkedin", "instagram"],
      description: "Target platform"
    },
    content: {
      type: "string",
      description: "Post text content"
    },
    media: {
      type: "array",
      items: { type: "string" },
      description: "Media URLs to attach"
    }
  },
  required: ["platform", "content"]
}
```

### generate_copy

```typescript
{
  name: "generate_copy",
  description: "Generate marketing copy for platforms",
  parameters: {
    input: {
      type: "string",
      description: "Product/topic description"
    },
    platforms: {
      type: "array",
      items: { type: "string" },
      description: "Target platforms"
    },
    brandProfileId: {
      type: "string",
      description: "Brand profile to use"
    },
    contentType: {
      type: "string",
      enum: ["product", "promotion", "announcement"],
      description: "Type of content"
    }
  },
  required: ["input", "platforms", "brandProfileId"]
}
```

### cross_post

```typescript
{
  name: "cross_post",
  description: "Publish to multiple platforms at once",
  parameters: {
    platforms: {
      type: "array",
      items: { type: "string" },
      description: "Target platforms"
    },
    content: {
      type: "object",
      properties: {
        text: { type: "string" },
        media: { type: "array", items: { type: "string" } }
      }
    },
    adaptContent: {
      type: "boolean",
      description: "Auto-adapt content for each platform"
    }
  },
  required: ["platforms", "content"]
}
```

## Example Usage

### Via Gemini CLI

```
User: "帮 OMECA 发一条关于新年促销的帖子"

Gemini:
  1. Calls get_material_pool() → Gets available materials
  2. Calls generate_copy() → Generates promotional copy
  3. Calls cross_post() → Publishes to multiple platforms

Result: Posted to Facebook, Twitter, LinkedIn
```

### Via API

```typescript
const mcp = new MCPClient('24rabbit-server');

// Generate and post
const copy = await mcp.call('generate_copy', {
  input: 'OMECA 新年促销，全场8折',
  platforms: ['facebook', 'twitter'],
  brandProfileId: 'brand_123',
  contentType: 'promotion'
});

await mcp.call('cross_post', {
  platforms: ['facebook', 'twitter'],
  content: { text: copy.facebook },
  adaptContent: true
});
```

---

*Related: [Architecture](./01-architecture.md) | [Platforms](./05-platforms.md)*
