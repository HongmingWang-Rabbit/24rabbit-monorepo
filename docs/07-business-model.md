# Business Model & Pricing

## Credit-Based Pricing

All operations consume Credits. This provides flexibility and transparency.

### Credit Consumption Rules

| Operation | Credits | Description |
|-----------|---------|-------------|
| AI Generate Content | 1 | Basic copy generation |
| AI + Trending Generate | 2 | Analyze trends + generate |
| AI Rewrite Material | 1 | User provides material, AI rewrites |
| Publish to Platform | 1 | Per platform |
| Cross-Platform Publish (3+) | 2 | Bulk discount |
| Get Analytics Report | 1 | Per data pull |

### Typical Usage Examples

- Daily auto-post (AI generate + publish) = **2 Credits/day** = 60 Credits/month
- Trending post (trending + generate + publish) = **3 Credits/time**
- Cross-post to 3 platforms = **2 Credits** (bulk discount)

## Subscription Tiers (Monthly or Yearly)

| Tier | Price/Month or Year | Credits | Features |
|------|---------------|---------|----------|
| **Starter** | $29 | 300 | 1 social account, basic analytics |
| **Growth** | $79 | 1,000 | 3 social accounts, trending tracking, priority queue |
| **Business** | $199 | 3,000 | Unlimited accounts, API access, dedicated support |

### Credit Allocation

- **Starter 300** = ~5 posts/day (sufficient for small businesses)
- **Growth 1,000** = ~11 posts/day (multi-platform operations)
- **Business 3,000** = ~33 posts/day (agencies/multi-brand)

### Overage Handling

- Purchase additional: **$10 = 100 Credits**
- Auto-upgrade to next tier (prorated)

## Free Trial

- **Registration bonus:** 30 Credits (enough for ~15 publish actions)
- No credit card required for trial
- Credits expire after 30 days if not subscribed

## Payment Integration

- **Primary:** Stripe (international credit cards)
- **Future:** Add Alipay/WeChat Pay for Chinese market

### Stripe Integration

```typescript
// Subscription products
const products = {
  starter: {
    priceId: 'price_starter_monthly',
    credits: 300,
    price: 2900  // cents
  },
  growth: {
    priceId: 'price_growth_monthly',
    credits: 1000,
    price: 7900
  },
  business: {
    priceId: 'price_business_monthly',
    credits: 3000,
    price: 19900
  }
};

// Credit top-up
const topUp = {
  priceId: 'price_credits_100',
  credits: 100,
  price: 1000  // $10
};
```

## Billing Cycle

```
User subscribes (e.g., Jan 1)
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Month 1: Jan 1 - Jan 31                         │
│  • Credits allocated: 300/1000/3000              │
│  • Credits used: tracked in real-time            │
│  • Overage: purchase additional or auto-upgrade  │
└──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Month 2: Feb 1 - Feb 28                         │
│  • Auto-renew (if not cancelled)                 │
│  • Unused credits do NOT roll over               │
│  • New credits allocated                         │
└─────────────────────────────────────────────────┘
```

## Revenue Projections

| Users | Tier Mix | Monthly Revenue |
|-------|----------|-----------------|
| 100 | 60% Starter, 30% Growth, 10% Business | ~$1,500 |
| 1,000 | 50% Starter, 35% Growth, 15% Business | ~$18,000 |
| 10,000 | 40% Starter, 40% Growth, 20% Business | ~$200,000 |

---

*Related: [MVP Scope](./11-mvp-scope.md) | [Acceptance Criteria](./12-acceptance-criteria.md)*
