# Acceptance Criteria

## Core User Flows

### Flow 1: New User Onboarding

```
1. User visits landing page
2. User signs up with email/Google
3. System creates account, grants 30 free Credits
4. User is redirected to onboarding wizard
5. User creates first Brand Profile
   - Brand name, tagline, tone
   - Target audience
   - Content instructions
6. User connects Facebook account (OAuth)
7. System stores encrypted tokens
8. User sees dashboard with connected account
```

**Acceptance Criteria:**
- [ ] Sign up with email works
- [ ] Sign up with Google works
- [ ] 30 Credits automatically granted
- [ ] Brand Profile created successfully
- [ ] Facebook OAuth flow completes
- [ ] Tokens stored encrypted
- [ ] Dashboard shows connected account

### Flow 2: Manual Content Generation & Publish

```
1. User navigates to "Create Post"
2. User enters text OR uploads image/video
3. User clicks "Generate Content"
4. AI generates platform-optimized content
5. User previews generated content
6. User can edit if needed
7. User selects platforms (Facebook)
8. User clicks "Publish"
9. Content published to Facebook
10. Credits deducted
11. Post recorded in history
```

**Acceptance Criteria:**
- [ ] Text input generates content
- [ ] Image upload generates content
- [ ] Preview shows correctly formatted content
- [ ] Edit functionality works
- [ ] Publish to Facebook succeeds
- [ ] Credits deducted correctly
- [ ] Post appears in history

### Flow 3: Automated Publishing

```
1. User sets up Schedule (e.g., daily 9am)
2. User uploads materials to pool
3. User enables auto-publish (no approval)
4. System triggers at scheduled time
5. AI selects material from pool
6. AI generates platform-optimized content
7. Content published automatically
8. User receives notification (optional)
9. Credits deducted
```

**Acceptance Criteria:**
- [ ] Schedule creation works
- [ ] Cron expression validates correctly
- [ ] Material upload works
- [ ] Scheduled job triggers on time
- [ ] AI selects appropriate material
- [ ] Content generated correctly
- [ ] Published without manual intervention
- [ ] Credits deducted
- [ ] Notification sent (if enabled)

### Flow 4: Approval Workflow

```
1. User enables approval in Brand Profile
2. Schedule triggers content generation
3. System creates PendingPost
4. User receives notification
5. User reviews content in dashboard
6. User approves/edits/rejects
7. If approved: content published
8. Credits deducted only on publish
```

**Acceptance Criteria:**
- [ ] Approval toggle works
- [ ] PendingPost created correctly
- [ ] Notification sent
- [ ] Preview shows in dashboard
- [ ] Approve action publishes content
- [ ] Edit action allows modification
- [ ] Reject action discards content
- [ ] Expired posts marked correctly
- [ ] Credits only deducted on publish

### Flow 5: Subscription & Payment

```
1. User clicks "Upgrade"
2. User selects tier (Starter/Growth/Business)
3. Redirected to Stripe Checkout
4. User completes payment
5. Stripe webhook received
6. Subscription activated
7. Credits allocated immediately
8. User sees updated dashboard
```

**Acceptance Criteria:**
- [ ] Upgrade button visible
- [ ] Tier selection works
- [ ] Stripe Checkout loads
- [ ] Payment completes
- [ ] Webhook processed correctly
- [ ] Subscription status updated
- [ ] Credits allocated
- [ ] Dashboard reflects new tier

## Test Scenarios

### Happy Path

| Scenario | Expected Result |
|----------|-----------------|
| Complete onboarding flow | Account created, FB connected |
| Generate and publish content | Post visible on Facebook |
| Schedule works at correct time | Content published automatically |
| Credits deducted correctly | Balance reduced by expected amount |
| Upgrade subscription | New tier active, credits allocated |

### Edge Cases

| Scenario | Expected Handling |
|----------|-------------------|
| Facebook token expires | Prompt user to reconnect |
| Insufficient credits | Block action, show upgrade prompt |
| API rate limit hit | Retry with exponential backoff |
| Content generation fails | Retry once, then notify user |
| Duplicate content detected | Skip or offer to regenerate |
| Schedule job fails | Retry 3 times, then alert |
| Webhook delivery fails | Stripe retries automatically |

### Error Handling

| Error | Response |
|-------|----------|
| Network failure during publish | Queue retry (up to 3 times) |
| Invalid media format | Clear error message, reject upload |
| Stripe webhook signature invalid | Log and ignore |
| Database connection lost | Graceful degradation, retry |
| AI API unavailable | Queue for retry, notify if persistent |

## Integration Tests

### Facebook Integration

```typescript
describe('Facebook Integration', () => {
  it('should complete OAuth flow', async () => {
    // Test OAuth redirect
    // Test callback handling
    // Test token storage
  });

  it('should publish text post', async () => {
    // Create post
    // Verify on Facebook
  });

  it('should publish image post', async () => {
    // Upload image
    // Create post with image
    // Verify on Facebook
  });

  it('should handle token expiry', async () => {
    // Simulate expired token
    // Verify refresh flow
  });
});
```

### Credit System

```typescript
describe('Credit System', () => {
  it('should deduct credits on generation', async () => {
    const before = await getCredits(userId);
    await generateContent(userId, input);
    const after = await getCredits(userId);
    expect(after).toBe(before - 1);
  });

  it('should deduct credits on publish', async () => {
    const before = await getCredits(userId);
    await publishPost(userId, postId);
    const after = await getCredits(userId);
    expect(after).toBe(before - 1);
  });

  it('should block action when insufficient', async () => {
    await setCredits(userId, 0);
    await expect(generateContent(userId, input))
      .rejects.toThrow('Insufficient credits');
  });
});
```

### Scheduling

```typescript
describe('Scheduling', () => {
  it('should trigger at correct time', async () => {
    // Create schedule for specific time
    // Fast-forward time
    // Verify job executed
  });

  it('should respect timezone', async () => {
    // Create schedule in PST
    // Verify triggers at PST time
  });

  it('should handle missed job', async () => {
    // Simulate server downtime
    // Verify job runs on recovery
  });
});
```

## Performance Requirements

| Metric | Target |
|--------|--------|
| Page load time | < 2s |
| API response time | < 500ms |
| Content generation | < 10s |
| Publish to platform | < 5s |
| Schedule accuracy | ± 1 minute |

## Security Tests

- [ ] OAuth tokens encrypted at rest
- [ ] API endpoints require authentication
- [ ] Rate limiting prevents abuse
- [ ] CSRF protection enabled
- [ ] SQL injection prevented
- [ ] XSS prevented
- [ ] Sensitive data not logged

---

*Related: [MVP Scope](./11-mvp-scope.md) | [Security](./13-security.md)*
