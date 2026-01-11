# Security Considerations

## Data Protection

### Encryption at Rest

```typescript
// All OAuth tokens encrypted with AES-256-GCM
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(encryptedText: string): string {
  const buffer = Buffer.from(encryptedText, 'base64');
  const iv = buffer.subarray(0, 16);
  const tag = buffer.subarray(16, 32);
  const encrypted = buffer.subarray(32);
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```

### Sensitive Data

| Data Type | Storage | Encryption |
|-----------|---------|------------|
| OAuth tokens | Database | AES-256-GCM |
| API keys | Environment | Not in code |
| User passwords | Database | Better Auth (hashed) |
| Payment info | Stripe | Not stored locally |

### Data Retention

- Soft delete for user data (GDPR)
- Permanent delete after 30 days
- Audit logs retained for 90 days

## HTTPS Everywhere

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          }
        ]
      }
    ];
  }
};
```

## API Security

### Authentication

```typescript
// All API routes require authentication
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function requireAuth() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session.user;
}
```

### Rate Limiting

```typescript
// Using Upstash Ratelimit
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'), // 10 requests per 10 seconds
});

export async function checkRateLimit(identifier: string) {
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
  if (!success) {
    throw new Error('Rate limit exceeded');
  }
  return { limit, reset, remaining };
}
```

### CSRF Protection

```typescript
// Better Auth handles CSRF for auth routes automatically
// For custom API routes, use custom token validation
import { randomBytes, timingSafeEqual } from 'crypto';

export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

export function validateCSRFToken(token: string, expected: string): boolean {
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
```

### Input Validation

```typescript
// Using Zod for all API inputs
import { z } from 'zod';

export const createPostSchema = z.object({
  content: z.string().min(1).max(10000),
  platforms: z.array(z.enum(['facebook', 'twitter', 'linkedin'])),
  mediaUrls: z.array(z.string().url()).optional(),
  scheduledAt: z.string().datetime().optional(),
});

// In API route
export async function POST(req: Request) {
  const body = await req.json();
  const validated = createPostSchema.parse(body); // Throws if invalid
  // ... proceed with validated data
}
```

### SQL Injection Prevention

```typescript
// Prisma ORM prevents SQL injection by design
// Never use raw queries with user input

// GOOD - Parameterized query
const posts = await prisma.post.findMany({
  where: { userId: session.user.id },
});

// BAD - Raw query with user input (never do this)
// const posts = await prisma.$queryRaw`SELECT * FROM posts WHERE userId = ${userId}`;
```

## OAuth Security

### Token Storage

```typescript
// Store encrypted tokens
const socialAccount = await prisma.socialAccount.create({
  data: {
    userId: session.user.id,
    platform: 'facebook',
    accessToken: encrypt(accessToken),
    refreshToken: refreshToken ? encrypt(refreshToken) : null,
    tokenExpiresAt: expiresAt,
  },
});
```

### Token Refresh

```typescript
// Check and refresh expired tokens
async function getValidToken(accountId: string): Promise<string> {
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) throw new Error('Account not found');

  // Check if token expired
  if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
    // Refresh token
    const newTokens = await refreshOAuthToken(
      account.platform,
      decrypt(account.refreshToken!)
    );

    // Update stored tokens
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        accessToken: encrypt(newTokens.accessToken),
        tokenExpiresAt: newTokens.expiresAt,
      },
    });

    return newTokens.accessToken;
  }

  return decrypt(account.accessToken);
}
```

## Stripe Webhook Security

```typescript
// Verify Stripe webhook signature
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed');
    return new Response('Invalid signature', { status: 400 });
  }

  // Process event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.data.object);
      break;
    // ... other events
  }

  return new Response('OK', { status: 200 });
}
```

## Logging Security

```typescript
// Never log sensitive data
const sanitizeLog = (data: any) => {
  const sensitive = ['accessToken', 'refreshToken', 'password', 'apiKey'];
  const sanitized = { ...data };

  for (const key of sensitive) {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
};

// Usage
console.log('Processing account:', sanitizeLog(account));
```

## Compliance

### GDPR Requirements

| Requirement | Implementation |
|-------------|----------------|
| Data access | Export user data on request |
| Data deletion | Delete all user data on request |
| Consent | Clear opt-in for data processing |
| Data portability | JSON export of user data |

### Required Documents

- [ ] Privacy Policy
- [ ] Terms of Service
- [ ] Cookie Policy
- [ ] Data Processing Agreement (for enterprise)

### Cookie Consent

```typescript
// Show cookie consent banner for EU users
import { hasCookie, setCookie } from 'cookies-next';

export function CookieConsent() {
  const [show, setShow] = useState(!hasCookie('cookie-consent'));

  const accept = () => {
    setCookie('cookie-consent', 'accepted', { maxAge: 365 * 24 * 60 * 60 });
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 ...">
      We use cookies to improve your experience.
      <button onClick={accept}>Accept</button>
    </div>
  );
}
```

## Security Checklist

### Before Launch

- [ ] All OAuth tokens encrypted
- [ ] Rate limiting configured
- [ ] CSRF protection enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection tests passed
- [ ] XSS tests passed
- [ ] HTTPS enforced
- [ ] Sensitive data not in logs
- [ ] Stripe webhook signature verified
- [ ] Privacy Policy published
- [ ] Terms of Service published
- [ ] Cookie consent implemented

### Ongoing

- [ ] Regular dependency updates
- [ ] Security audit monthly
- [ ] Monitor for suspicious activity
- [ ] Rotate encryption keys annually
- [ ] Review access logs weekly

---

*Related: [Data Model](./10-data-model.md) | [Acceptance Criteria](./12-acceptance-criteria.md)*
