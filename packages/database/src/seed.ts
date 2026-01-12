/* eslint-disable no-console */
import { db } from './db';
import { user, organizations, organizationMembers, subscriptions, brandProfiles } from './schema';
import { createId } from '@paralleldrive/cuid2';

// Prevent accidental seeding of production database
if (process.env.NODE_ENV === 'production' && !process.env.FORCE_SEED) {
  console.error('ERROR: Refusing to seed production database.');
  console.error('Set FORCE_SEED=true to override this check.');
  process.exit(1);
}

async function seed() {
  console.log('Seeding database...');

  // Create a test user
  const userId = createId();
  await db
    .insert(user)
    .values({
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: true,
    })
    .onConflictDoNothing();

  console.log('Created test user:', userId);

  // Create a test organization
  const orgId = createId();
  await db
    .insert(organizations)
    .values({
      id: orgId,
      name: 'Test Organization',
      slug: 'test-org',
    })
    .onConflictDoNothing();

  console.log('Created test organization:', orgId);

  // Create organization membership
  await db
    .insert(organizationMembers)
    .values({
      organizationId: orgId,
      userId: userId,
      role: 'OWNER',
    })
    .onConflictDoNothing();

  console.log('Created organization membership');

  // Create subscription
  await db
    .insert(subscriptions)
    .values({
      organizationId: orgId,
      tier: 'FREE',
      status: 'ACTIVE',
      creditsTotal: 100,
      creditsUsed: 0,
    })
    .onConflictDoNothing();

  console.log('Created subscription');

  // Create a test brand profile
  const brandId = createId();
  await db
    .insert(brandProfiles)
    .values({
      id: brandId,
      organizationId: orgId,
      name: 'Test Brand',
      tone: ['professional', 'friendly'],
      personality: 'A helpful and knowledgeable brand that focuses on providing value.',
      targetAudience: 'Small business owners and entrepreneurs',
      contentPillars: [
        { name: 'Tips & Tricks', percentage: 40 },
        { name: 'Industry News', percentage: 30 },
        { name: 'Behind the Scenes', percentage: 30 },
      ],
      autoApprove: true,
    })
    .onConflictDoNothing();

  console.log('Created test brand profile:', brandId);

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
