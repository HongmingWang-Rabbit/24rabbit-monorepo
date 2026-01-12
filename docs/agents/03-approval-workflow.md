# Approval Workflow Rules

This document describes how content flows through the approval process, including auto-approval, manual review, user actions, notifications, and timeout handling.

## Approval Routing

After content generation, the agent routes content based on approval configuration:

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPROVAL ROUTING                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Content Generated                                               │
│         │                                                         │
│         ▼                                                         │
│  ┌─────────────────────┐                                         │
│  │ Check autoApprove   │                                         │
│  │ setting             │                                         │
│  └──────────┬──────────┘                                         │
│             │                                                     │
│      ┌──────┴──────┐                                             │
│      │             │                                             │
│      ▼             ▼                                             │
│  autoApprove    autoApprove                                      │
│  = true         = false                                          │
│      │             │                                             │
│      ▼             ▼                                             │
│  ┌──────────┐  ┌──────────────┐                                  │
│  │  AUTO_   │  │   PENDING    │                                  │
│  │ APPROVED │  │              │                                  │
│  └────┬─────┘  └──────┬───────┘                                  │
│       │               │                                           │
│       │               ▼                                           │
│       │        ┌──────────────┐                                  │
│       │        │   Notify     │                                  │
│       │        │   User       │                                  │
│       │        └──────┬───────┘                                  │
│       │               │                                           │
│       │               ▼                                           │
│       │        ┌──────────────┐                                  │
│       │        │  Await User  │                                  │
│       │        │   Action     │                                  │
│       │        └──────────────┘                                  │
│       │                                                           │
│       ▼                                                           │
│  Wait for scheduledFor time                                       │
│       │                                                           │
│       ▼                                                           │
│  Queue publish job                                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Approval Configuration

### Schedule-Level Setting

```typescript
interface Schedule {
  autoApprove: boolean  // Override for this specific schedule
}
```

### Brand Profile Default

```typescript
interface BrandProfile {
  requireApproval: boolean    // Default for all schedules
  approvalTimeout: number     // Hours before expiration (default: 24)
  notifyEmail?: string        // Email for approval notifications
  notifyWebhook?: string      // Webhook URL for integrations
}
```

### Resolution Logic

```typescript
function determineApprovalMode(schedule: Schedule, brandProfile: BrandProfile): boolean {
  // Schedule setting takes precedence
  if (schedule.autoApprove !== undefined) {
    return schedule.autoApprove
  }
  // Fall back to brand profile default
  return !brandProfile.requireApproval
}
```

## PendingPost States

```
┌─────────────────────────────────────────────────────────────────┐
│                   PENDING POST STATE MACHINE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│                      ┌─────────┐                                 │
│                      │  DRAFT  │ (manual creation, not scheduled)│
│                      └────┬────┘                                 │
│                           │ submit                               │
│                           ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                                                             │ │
│  │  ┌─────────────┐              ┌───────────────┐            │ │
│  │  │   PENDING   │              │ AUTO_APPROVED │            │ │
│  │  │             │              │               │            │ │
│  │  └──────┬──────┘              └───────┬───────┘            │ │
│  │         │                             │                     │ │
│  │         │ User actions:               │                     │ │
│  │         │ • approve                   │                     │ │
│  │         │ • reject                    │                     │ │
│  │         │ • edit                      │                     │ │
│  │         │                             │                     │ │
│  │         ▼                             │                     │ │
│  │  ┌─────────────┐                      │                     │ │
│  │  │  APPROVED   │◄─────────────────────┘                     │ │
│  │  └──────┬──────┘                                            │ │
│  │         │                                                    │ │
│  │         │ scheduledFor time reached                          │ │
│  │         ▼                                                    │ │
│  │  ┌─────────────┐                                            │ │
│  │  │ PUBLISHING  │                                            │ │
│  │  └──────┬──────┘                                            │ │
│  │         │                                                    │ │
│  │    ┌────┴────┐                                              │ │
│  │    │         │                                              │ │
│  │    ▼         ▼                                              │ │
│  │ ┌──────┐  ┌──────┐                                          │ │
│  │ │PUBLIS│  │FAILED│                                          │ │
│  │ │ HED  │  │      │                                          │ │
│  │ └──────┘  └──────┘                                          │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Other terminal states:                                          │
│                                                                   │
│  ┌──────────┐  ┌──────────┐                                      │
│  │ REJECTED │  │ EXPIRED  │                                      │
│  └──────────┘  └──────────┘                                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### State Definitions

| State | Description | Transitions |
|-------|-------------|-------------|
| `DRAFT` | Manual creation, not yet submitted | → PENDING (submit) |
| `PENDING` | Awaiting user approval | → APPROVED, REJECTED, EXPIRED |
| `AUTO_APPROVED` | Automatically approved, awaiting publish time | → PUBLISHING |
| `APPROVED` | User approved, awaiting publish time | → PUBLISHING |
| `REJECTED` | User rejected content | Terminal state |
| `EXPIRED` | Approval timeout exceeded | Terminal state |
| `PUBLISHING` | Currently being published | → PUBLISHED, FAILED |
| `PUBLISHED` | Successfully posted to platform | Terminal state |
| `FAILED` | Publishing failed after all retries | Terminal state |

## User Actions

### 1. Select Variation

User can choose between the 3 generated variations:

```typescript
async function selectVariation(pendingPostId: string, variationIndex: number) {
  const pendingPost = await prisma.pendingPost.update({
    where: { id: pendingPostId },
    data: {
      selectedVariation: variationIndex,
      finalContent: pendingPost.variations[variationIndex].content
    }
  })
}
```

### 2. Edit Content

User can modify the selected variation's content:

```typescript
async function editContent(pendingPostId: string, newContent: string) {
  // Validate against platform limits
  const pendingPost = await prisma.pendingPost.findUnique({
    where: { id: pendingPostId }
  })

  const limit = PLATFORM_LIMITS[pendingPost.platform].maxChars
  if (newContent.length > limit) {
    throw new Error(`Content exceeds ${limit} character limit for ${pendingPost.platform}`)
  }

  await prisma.pendingPost.update({
    where: { id: pendingPostId },
    data: {
      finalContent: newContent,
      wasEdited: true
    }
  })
}
```

### 3. Approve

User approves content for publishing:

```typescript
async function approvePost(pendingPostId: string) {
  const pendingPost = await prisma.pendingPost.update({
    where: { id: pendingPostId },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: userId
    }
  })

  // If scheduled time is in the past, publish immediately
  if (pendingPost.scheduledFor <= new Date()) {
    await publishQueue.add('publish', {
      pendingPostId: pendingPost.id
    })
  }
  // Otherwise, scheduled job will pick it up
}
```

### 4. Reject

User rejects content (won't be published):

```typescript
async function rejectPost(pendingPostId: string, reason?: string) {
  await prisma.pendingPost.update({
    where: { id: pendingPostId },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectionReason: reason
    }
  })

  // Note: Credits are NOT refunded on rejection
  // Content was generated, user chose not to use it
}
```

### 5. Regenerate

User requests new variations:

```typescript
async function regenerateVariations(pendingPostId: string) {
  const pendingPost = await prisma.pendingPost.findUnique({
    where: { id: pendingPostId },
    include: { material: true, brandProfile: true }
  })

  // Deduct additional credit for regeneration
  await deductCredits(pendingPost.userId, CREDIT_COSTS.TEXT_GENERATION)

  // Queue new generation job
  await contentGenerateQueue.add('regenerate', {
    pendingPostId: pendingPost.id,
    materialId: pendingPost.materialId,
    brandProfileId: pendingPost.brandProfileId,
    platform: pendingPost.platform,
    excludeAngles: pendingPost.variations.map(v => v.angle)  // Avoid same angles
  })
}
```

### 6. Reschedule

User changes the publish time:

```typescript
async function reschedulePost(pendingPostId: string, newScheduledFor: Date) {
  // Validate: must be in the future
  if (newScheduledFor <= new Date()) {
    throw new Error('Scheduled time must be in the future')
  }

  await prisma.pendingPost.update({
    where: { id: pendingPostId },
    data: {
      scheduledFor: newScheduledFor
    }
  })
}
```

## Notification System

When content enters PENDING status, users are notified:

### Email Notification

```typescript
async function sendApprovalEmail(pendingPost: PendingPost, brandProfile: BrandProfile) {
  if (!brandProfile.notifyEmail) return

  await emailService.send({
    to: brandProfile.notifyEmail,
    subject: `[24Rabbit] Content ready for review - ${brandProfile.name}`,
    template: 'approval-request',
    data: {
      brandName: brandProfile.name,
      platform: pendingPost.platform,
      scheduledFor: pendingPost.scheduledFor,
      previewContent: pendingPost.variations[0].content.slice(0, 200),
      approvalUrl: `${APP_URL}/pending/${pendingPost.id}`,
      expiresAt: addHours(pendingPost.createdAt, brandProfile.approvalTimeout)
    }
  })
}
```

### Webhook Notification

```typescript
async function sendApprovalWebhook(pendingPost: PendingPost, brandProfile: BrandProfile) {
  if (!brandProfile.notifyWebhook) return

  await fetch(brandProfile.notifyWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'pending_post.created',
      data: {
        id: pendingPost.id,
        brandProfileId: brandProfile.id,
        platform: pendingPost.platform,
        scheduledFor: pendingPost.scheduledFor,
        variations: pendingPost.variations,
        approvalUrl: `${APP_URL}/pending/${pendingPost.id}`,
        expiresAt: addHours(pendingPost.createdAt, brandProfile.approvalTimeout)
      }
    })
  })
}
```

### Dashboard Notification

```typescript
// Real-time notification via WebSocket or polling
await prisma.notification.create({
  data: {
    userId: brandProfile.userId,
    type: 'PENDING_APPROVAL',
    title: 'Content ready for review',
    message: `New ${pendingPost.platform} post for ${brandProfile.name}`,
    actionUrl: `/pending/${pendingPost.id}`,
    read: false
  }
})
```

## Timeout Handling

Pending posts expire after the configured timeout period.

### Expiration Check (Cron)

```typescript
// Runs every 15 minutes
async function checkExpiredPendingPosts() {
  const now = new Date()

  // Find PENDING posts past their expiration
  const expiredPosts = await prisma.pendingPost.findMany({
    where: {
      status: 'PENDING',
      createdAt: {
        lt: subHours(now, 24)  // Default 24-hour timeout
      }
    },
    include: {
      brandProfile: true
    }
  })

  for (const post of expiredPosts) {
    // Check brand-specific timeout
    const expiresAt = addHours(post.createdAt, post.brandProfile.approvalTimeout || 24)

    if (now > expiresAt) {
      await prisma.pendingPost.update({
        where: { id: post.id },
        data: {
          status: 'EXPIRED',
          expiredAt: now
        }
      })

      // Notify user of expiration
      await notifyExpiration(post)
    }
  }
}
```

### Expiration Notification

```typescript
async function notifyExpiration(pendingPost: PendingPost) {
  await prisma.notification.create({
    data: {
      userId: pendingPost.userId,
      type: 'POST_EXPIRED',
      title: 'Content expired',
      message: `Scheduled ${pendingPost.platform} post expired without approval`,
      read: false
    }
  })
}
```

## Publish Triggering

Approved content is published when the scheduled time arrives.

### Publish Scheduler (Cron)

```typescript
// Runs every minute
async function checkScheduledPublishes() {
  const now = new Date()

  // Find approved posts ready to publish
  const readyPosts = await prisma.pendingPost.findMany({
    where: {
      status: {
        in: ['APPROVED', 'AUTO_APPROVED']
      },
      scheduledFor: {
        lte: now
      }
    }
  })

  for (const post of readyPosts) {
    // Mark as publishing to prevent duplicate processing
    await prisma.pendingPost.update({
      where: { id: post.id },
      data: { status: 'PUBLISHING' }
    })

    // Queue publish job
    await publishQueue.add('publish', {
      pendingPostId: post.id
    })
  }
}
```

### Immediate Publish

If user approves after the scheduled time has passed:

```typescript
async function approvePost(pendingPostId: string) {
  const pendingPost = await prisma.pendingPost.update({
    where: { id: pendingPostId },
    data: {
      status: 'APPROVED',
      approvedAt: new Date()
    }
  })

  // Check if we should publish immediately
  if (pendingPost.scheduledFor <= new Date()) {
    await prisma.pendingPost.update({
      where: { id: pendingPostId },
      data: { status: 'PUBLISHING' }
    })

    await publishQueue.add('publish', {
      pendingPostId: pendingPost.id
    }, {
      priority: 1  // High priority for immediate publish
    })
  }
}
```

## Bulk Operations

### Bulk Approve

```typescript
async function bulkApprove(pendingPostIds: string[]) {
  const now = new Date()

  await prisma.pendingPost.updateMany({
    where: {
      id: { in: pendingPostIds },
      status: 'PENDING'
    },
    data: {
      status: 'APPROVED',
      approvedAt: now
    }
  })

  // Queue publishes for any past-due posts
  const approvedPosts = await prisma.pendingPost.findMany({
    where: {
      id: { in: pendingPostIds },
      status: 'APPROVED',
      scheduledFor: { lte: now }
    }
  })

  for (const post of approvedPosts) {
    await publishQueue.add('publish', { pendingPostId: post.id })
  }
}
```

### Bulk Reject

```typescript
async function bulkReject(pendingPostIds: string[], reason?: string) {
  await prisma.pendingPost.updateMany({
    where: {
      id: { in: pendingPostIds },
      status: 'PENDING'
    },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectionReason: reason
    }
  })
}
```

## Approval Analytics

Track approval metrics for optimization:

```typescript
interface ApprovalMetrics {
  totalPending: number
  averageApprovalTime: number      // Minutes from creation to approval
  approvalRate: number             // % approved vs rejected
  expirationRate: number           // % that expired
  editRate: number                 // % that were edited before approval
  variationDistribution: {         // Which variation is selected most
    0: number
    1: number
    2: number
  }
  regenerationRate: number         // % that requested regeneration
}
```

These metrics help tune:
- Default variation ordering (most-selected first)
- Approval timeout duration
- Auto-approve recommendations
- AI generation quality
