# Supported Platforms

## Official API Support

| Platform | API | Supported Features |
|----------|-----|-------------------|
| Facebook | Graph API | Post, page management, Stories |
| Twitter/X | API v2 | Tweet, media upload |
| LinkedIn | Marketing API | Post, company page |
| Instagram | Graph API | Post (requires Business account) |
| YouTube | Data API v3 | Video upload, Community Post |
| Reddit | API | Post, comment |
| Threads | Threads API | Post, media upload |

## Platform Rollout Plan

```
Phase 1 (MVP):     Facebook
Phase 2:           + Twitter/X, LinkedIn
Phase 3:           + Instagram, Threads
Phase 4:           + YouTube, Reddit, TikTok (when API available)
```

## Not Yet Supported

| Platform | Reason |
|----------|--------|
| Xiaohongshu (RED) | No posting API (e-commerce API only) |
| Douyin | Limited API functionality |
| TikTok | Limited API functionality |

## Platform-Specific Requirements

### Facebook

- **Auth:** OAuth 2.0 via Facebook Login
- **Permissions:** `pages_manage_posts`, `pages_read_engagement`
- **Account Type:** Facebook Page (not personal profile)
- **Media:** Images, videos, carousels supported
- **Rate Limits:** 200 posts per hour per page

### Twitter/X

- **Auth:** OAuth 2.0
- **Permissions:** `tweet.write`, `users.read`
- **Account Type:** Standard or Premium
- **Media:** Up to 4 images or 1 video per tweet
- **Char Limit:** 280 characters
- **Rate Limits:** 50 posts/day

### LinkedIn

- **Auth:** OAuth 2.0
- **Permissions:** `w_member_social`
- **Account Type:** Personal or Company Page
- **Media:** Images, videos, documents
- **Char Limit:** 3000 characters
- **Rate Limits:** 100 posts/day

### Instagram

- **Auth:** Facebook Login (Instagram Business)
- **Permissions:** `instagram_content_publish`
- **Account Type:** Business or Creator account
- **Requirements:** Must be connected to Facebook Page
- **Media:** Images, videos, carousels, Reels

### YouTube

- **Auth:** Google OAuth 2.0
- **Permissions:** `youtube.upload`
- **Account Type:** YouTube Channel
- **Media:** Video only
- **Requirements:** YouTube channel in good standing

### Reddit

- **Auth:** OAuth 2.0
- **Permissions:** `submit`, `identity`
- **Account Type:** Reddit account with karma
- **Requirements:** Some subreddits have posting restrictions

### Threads

- **Auth:** OAuth 2.0 (via Instagram/Meta)
- **Permissions:** `threads_content_publish`
- **Account Type:** Threads account (linked to Instagram)
- **Media:** Images, videos supported
- **Char Limit:** 500 characters
- **Requirements:** Must have Instagram Business/Creator account

## Content Specifications

| Platform | Image Size | Video Spec | Copy Length |
|----------|------------|------------|-------------|
| Facebook | Various | Various | Long OK |
| Twitter | 16:9 | 16:9 | 280 chars |
| LinkedIn | 1.91:1 | Landscape | 3000 chars |
| Instagram Feed | 1:1 or 4:5 | 1:1 or 4:5 | 2200 chars |
| Instagram Reels | - | 9:16 portrait | Short |
| YouTube | 16:9 thumbnail | Landscape 16:9 | Long OK |
| Reddit | No limit | No limit | Title short |
| Threads | Various | Various | 500 chars |

## Platform Connectors

Each platform has a dedicated connector that implements the `PlatformConnector` interface:

```typescript
interface PlatformConnector {
  // Authentication
  authenticate(credentials: OAuthCredentials): Promise<void>
  refreshToken(): Promise<void>

  // Publishing
  publish(post: PostPayload): Promise<PublishResult>
  uploadMedia(media: MediaPayload): Promise<MediaResult>

  // Analytics
  getPostMetrics(postId: string): Promise<PostMetrics>
  getAccountMetrics(): Promise<AccountMetrics>
}
```

### Connector Implementations

```
packages/platforms/src/
├── types.ts              # PlatformConnector interface
├── facebook/
│   └── connector.ts      # FacebookConnector
├── twitter/
│   └── connector.ts      # TwitterConnector
├── linkedin/
│   └── connector.ts      # LinkedInConnector
├── instagram/
│   └── connector.ts      # InstagramConnector
├── youtube/
│   └── connector.ts      # YouTubeConnector
├── reddit/
│   └── connector.ts      # RedditConnector
└── threads/
    └── connector.ts      # ThreadsConnector
```

## Rate Limiting

Rate limits are tracked per platform in Redis:

```typescript
// Check rate limit before publishing
const key = `ratelimit:${platform}:${accountId}:${today}`
const count = await redis.incr(key)

if (count === 1) {
  await redis.expire(key, 86400) // 24 hours
}

if (count > PLATFORM_LIMITS[platform]) {
  // Delay job, re-queue for later
  throw new RateLimitError(platform)
}
```

### Platform Limits

| Platform | Daily Limit | Notes |
|----------|-------------|-------|
| Twitter | 50 posts/day | Per account |
| LinkedIn | 100 posts/day | Per account |
| Facebook | 200 posts/day | Per page |
| Instagram | 25 posts/day | Per account |
| Threads | 50 posts/day | Per account |
| YouTube | 100 videos/day | Per channel |
| Reddit | Varies | Per subreddit rules |

## Error Handling

Common platform errors and handling:

| Error | Cause | Action |
|-------|-------|--------|
| Token Expired | OAuth token expired | Refresh token, retry |
| Rate Limited | Too many requests | Delay, re-queue |
| Content Policy | Violates platform rules | Mark failed, notify user |
| Media Error | Invalid media format | Retry with different format |
| Account Suspended | Platform action | Mark account inactive |

---

*Related: [MCP Tools](./06-mcp-tools.md) | [AI Processing](./02-ai-processing.md)*
