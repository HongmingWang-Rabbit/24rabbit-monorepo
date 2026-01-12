import { pgTable, text, boolean, timestamp, integer, unique } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';
import { memberRole, subscriptionTier, subscriptionStatus, creditAction } from './enums';

export const organizations = pgTable('organizations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  stripeCustomerId: text('stripe_customer_id'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: memberRole('role').notNull().default('MEMBER'),
    invitedAt: timestamp('invited_at'),
    joinedAt: timestamp('joined_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqueMember: unique().on(table.organizationId, table.userId),
  })
);

export const subscriptions = pgTable('subscriptions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' })
    .unique(),
  tier: subscriptionTier('tier').notNull().default('FREE'),
  status: subscriptionStatus('status').notNull().default('ACTIVE'),
  creditsTotal: integer('credits_total').notNull().default(0),
  creditsUsed: integer('credits_used').notNull().default(0),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const creditTransactions = pgTable('credit_transactions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id),
  subscriptionId: text('subscription_id').references(() => subscriptions.id),
  amount: integer('amount').notNull(),
  action: creditAction('action').notNull(),
  description: text('description'),
  relatedPostId: text('related_post_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Type exports
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type NewCreditTransaction = typeof creditTransactions.$inferInsert;
