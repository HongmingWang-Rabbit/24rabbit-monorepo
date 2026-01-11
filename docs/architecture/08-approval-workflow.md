# Approval Workflow

## Approval Mode (User Configurable)

Users can choose whether AI-generated content requires manual approval before publishing.

```
Brand Profile Settings:
┌─────────────────────────────────────────────────┐
│  Approval Settings                               │
│  ┌─────────────────────────────────────────┐   │
│  │  ☐ Auto-publish (no approval needed)     │   │
│  │  ☑ Require approval before publish       │   │
│  │                                          │   │
│  │  Notification Method:                    │   │
│  │  • Email: user@example.com               │   │
│  │  • Webhook: https://...                  │   │
│  │  • Dashboard notification                │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Approval Workflow

```
AI Generates Content
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Check: requireApproval == true?                 │
│  ├── No  → Direct to publish queue              │
│  └── Yes → Create PendingPost                   │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Send Notification                               │
│  • Email with preview link                       │
│  • Webhook POST with content                     │
│  • Dashboard badge notification                  │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  User Actions (within 24 hours)                  │
│  ├── ✅ Approve → Publish immediately           │
│  ├── ✏️ Edit → Modify then publish              │
│  ├── ❌ Reject → Discard, optionally regenerate │
│  └── ⏰ Timeout → Auto-expire (no publish)      │
└─────────────────────────────────────────────────┘
```

## Pending Post Status

| Status | Description |
|--------|-------------|
| `pending` | Waiting for user action |
| `approved` | User approved, moving to publish |
| `rejected` | User rejected |
| `expired` | 24-hour timeout, auto-expired |

## Notification Methods

### Email Notification

```
Subject: [24Rabbit] Content ready for review

Hi {userName},

AI has generated new content for {brandName}:

---
{generatedContent}
---

Platform: {targetPlatforms}
Expires: {expiresAt}

[Approve] [Edit] [Reject]
```

### Webhook Notification

```typescript
// POST to user's webhook URL
{
  event: "pending_post.created",
  data: {
    pendingPostId: "pp_123",
    brandProfileId: "bp_456",
    content: "AI generated content here...",
    mediaUrls: ["https://..."],
    targetPlatforms: ["facebook", "twitter"],
    sourceType: "ai_generated",
    expiresAt: "2026-01-10T09:00:00Z"
  }
}
```

### Dashboard Notification

- Badge on navigation showing pending count
- Toast notification when new content is ready
- Email digest option (daily summary)

## Approval Actions

### Approve

```typescript
POST /api/pending-posts/{id}/approve

// Result:
// 1. PendingPost status → 'approved'
// 2. Create Post with status 'scheduled'
// 3. Add to publish queue
// 4. Deduct credits
```

### Edit & Approve

```typescript
POST /api/pending-posts/{id}/approve
{
  editedContent: "Modified content here...",
  editedMedia: ["https://..."]
}

// Result:
// 1. Update content before publishing
// 2. Same flow as approve
```

### Reject

```typescript
POST /api/pending-posts/{id}/reject
{
  reason: "Not suitable for brand",  // optional
  regenerate: true                    // optional
}

// Result:
// 1. PendingPost status → 'rejected'
// 2. If regenerate=true, trigger new generation
// 3. No credits deducted
```

## Configuration Options

```typescript
BrandProfile {
  // Approval settings
  requireApproval: boolean      // Enable/disable
  notifyEmail?: string          // Email for notifications
  notifyWebhook?: string        // Webhook URL
  approvalTimeout: number       // Hours before expiry (default: 24)

  // Auto-approve rules (future)
  autoApproveRules?: {
    minConfidence: number       // AI confidence threshold
    excludeTopics: string[]     // Topics that always need review
  }
}
```

## User Interaction Example

```
Schedule triggered at 9:00 AM
       │
       ▼
AI generates content for OMECA
       │
       ▼
┌─────────────────────────────────────────────────┐
│  "OMECA 新品上市！不锈钢餐具套装..."             │
│                                                 │
│  [Approve] [Edit] [Reject]                      │
│                                                 │
│  Expires in 23:59:32                            │
└─────────────────────────────────────────────────┘
       │
       ▼
User clicks [Edit]
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Edit content:                                   │
│  "OMECA 新品上市！限时8折..."                    │
│                                                 │
│  [Save & Publish] [Cancel]                      │
└─────────────────────────────────────────────────┘
       │
       ▼
Published to Facebook, Twitter
```

---

*Related: [Scheduling](./04-scheduling.md) | [Brand Config](./03-brand-config.md)*
