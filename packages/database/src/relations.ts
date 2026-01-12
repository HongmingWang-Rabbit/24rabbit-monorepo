import { relations } from 'drizzle-orm';
import { users } from './schema/users';
import {
  organizations,
  organizationMembers,
  subscriptions,
  creditTransactions,
} from './schema/organization';
import {
  brandProfiles,
  socialAccounts,
  brandProfileAccounts,
  schedules,
} from './schema/brand-profile';
import { materials, externalSources } from './schema/material';
import { posts, pendingPosts } from './schema/post';
import { contentEmbeddings } from './schema/embedding';

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  organizationMemberships: many(organizationMembers),
}));

// Organization relations
export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  subscription: one(subscriptions, {
    fields: [organizations.id],
    references: [subscriptions.organizationId],
  }),
  members: many(organizationMembers),
  brandProfiles: many(brandProfiles),
  socialAccounts: many(socialAccounts),
  materials: many(materials),
  posts: many(posts),
  pendingPosts: many(pendingPosts),
  creditTransactions: many(creditTransactions),
  contentEmbeddings: many(contentEmbeddings),
}));

// OrganizationMember relations
export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

// Subscription relations
export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [subscriptions.organizationId],
    references: [organizations.id],
  }),
  creditTransactions: many(creditTransactions),
}));

// CreditTransaction relations
export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  organization: one(organizations, {
    fields: [creditTransactions.organizationId],
    references: [organizations.id],
  }),
  subscription: one(subscriptions, {
    fields: [creditTransactions.subscriptionId],
    references: [subscriptions.id],
  }),
}));

// BrandProfile relations
export const brandProfilesRelations = relations(brandProfiles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [brandProfiles.organizationId],
    references: [organizations.id],
  }),
  brandProfileAccounts: many(brandProfileAccounts),
  schedules: many(schedules),
  materials: many(materials),
  externalSources: many(externalSources),
  posts: many(posts),
  pendingPosts: many(pendingPosts),
}));

// SocialAccount relations
export const socialAccountsRelations = relations(socialAccounts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [socialAccounts.organizationId],
    references: [organizations.id],
  }),
  brandProfileAccounts: many(brandProfileAccounts),
  posts: many(posts),
}));

// BrandProfileAccount relations (N:M join table)
export const brandProfileAccountsRelations = relations(brandProfileAccounts, ({ one }) => ({
  brandProfile: one(brandProfiles, {
    fields: [brandProfileAccounts.brandProfileId],
    references: [brandProfiles.id],
  }),
  socialAccount: one(socialAccounts, {
    fields: [brandProfileAccounts.socialAccountId],
    references: [socialAccounts.id],
  }),
}));

// Schedule relations
export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  brandProfile: one(brandProfiles, {
    fields: [schedules.brandProfileId],
    references: [brandProfiles.id],
  }),
  posts: many(posts),
  pendingPosts: many(pendingPosts),
}));

// Material relations
export const materialsRelations = relations(materials, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [materials.organizationId],
    references: [organizations.id],
  }),
  brandProfile: one(brandProfiles, {
    fields: [materials.brandProfileId],
    references: [brandProfiles.id],
  }),
  posts: many(posts),
  pendingPosts: many(pendingPosts),
}));

// ExternalSource relations
export const externalSourcesRelations = relations(externalSources, ({ one }) => ({
  organization: one(organizations, {
    fields: [externalSources.organizationId],
    references: [organizations.id],
  }),
  brandProfile: one(brandProfiles, {
    fields: [externalSources.brandProfileId],
    references: [brandProfiles.id],
  }),
}));

// Post relations
export const postsRelations = relations(posts, ({ one }) => ({
  organization: one(organizations, {
    fields: [posts.organizationId],
    references: [organizations.id],
  }),
  brandProfile: one(brandProfiles, {
    fields: [posts.brandProfileId],
    references: [brandProfiles.id],
  }),
  socialAccount: one(socialAccounts, {
    fields: [posts.socialAccountId],
    references: [socialAccounts.id],
  }),
  material: one(materials, {
    fields: [posts.materialId],
    references: [materials.id],
  }),
  schedule: one(schedules, {
    fields: [posts.scheduleId],
    references: [schedules.id],
  }),
  pendingPost: one(pendingPosts, {
    fields: [posts.pendingPostId],
    references: [pendingPosts.id],
  }),
}));

// PendingPost relations
export const pendingPostsRelations = relations(pendingPosts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [pendingPosts.organizationId],
    references: [organizations.id],
  }),
  brandProfile: one(brandProfiles, {
    fields: [pendingPosts.brandProfileId],
    references: [brandProfiles.id],
  }),
  material: one(materials, {
    fields: [pendingPosts.materialId],
    references: [materials.id],
  }),
  schedule: one(schedules, {
    fields: [pendingPosts.scheduleId],
    references: [schedules.id],
  }),
  posts: many(posts),
}));

// ContentEmbedding relations
export const contentEmbeddingsRelations = relations(contentEmbeddings, ({ one }) => ({
  organization: one(organizations, {
    fields: [contentEmbeddings.organizationId],
    references: [organizations.id],
  }),
}));
