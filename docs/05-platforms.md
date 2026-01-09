# Supported Platforms

## Official API Support ✅

| Platform | API | Supported Features |
|----------|-----|-------------------|
| Facebook | Graph API | Post, page management, Stories |
| Twitter/X | API v2 | Tweet, media upload |
| LinkedIn | Marketing API | Post, company page |
| Instagram | Graph API | Post (requires Business account) |
| YouTube | Data API v3 | Video upload, Community Post |
| Reddit | API | Post, comment |

## Platform Rollout Plan

```
Phase 1 (MVP):     Facebook
Phase 2:           + Twitter/X, LinkedIn
Phase 3:           + Instagram, YouTube
Phase 4:           + Reddit, TikTok (when API available)
```

## Not Yet Supported ⏳

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

### LinkedIn

- **Auth:** OAuth 2.0
- **Permissions:** `w_member_social`
- **Account Type:** Personal or Company Page
- **Media:** Images, videos, documents
- **Char Limit:** 3000 characters

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

---

*Related: [MCP Tools](./06-mcp-tools.md) | [AI Processing](./02-ai-processing.md)*
