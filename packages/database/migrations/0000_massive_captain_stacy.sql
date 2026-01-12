CREATE TYPE "public"."content_angle" AS ENUM('PRODUCT_FOCUS', 'USER_BENEFIT', 'STORYTELLING', 'EDUCATIONAL', 'SOCIAL_PROOF', 'PROMOTIONAL');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('MATERIAL', 'PENDING_POST', 'POST');--> statement-breakpoint
CREATE TYPE "public"."credit_action" AS ENUM('GENERATE', 'GENERATE_TRENDING', 'REWRITE', 'PUBLISH', 'ANALYTICS', 'TOPUP', 'SUBSCRIPTION');--> statement-breakpoint
CREATE TYPE "public"."font_preference" AS ENUM('MODERN', 'CLASSIC', 'HANDWRITTEN', 'MONOSPACE');--> statement-breakpoint
CREATE TYPE "public"."material_status" AS ENUM('UPLOADED', 'PROCESSING', 'ANALYZED', 'READY', 'USED', 'ARCHIVED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."material_type" AS ENUM('TEXT', 'URL', 'FILE', 'IMAGE', 'VIDEO');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."pending_post_status" AS ENUM('PENDING', 'AUTO_APPROVED', 'PUBLISHED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."social_platform" AS ENUM('FACEBOOK', 'TWITTER', 'LINKEDIN', 'INSTAGRAM', 'YOUTUBE', 'REDDIT', 'TIKTOK', 'THREADS');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('ACTIVE', 'CANCELLED', 'PAST_DUE', 'TRIALING', 'PAUSED');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('FREE', 'STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE');--> statement-breakpoint
CREATE TYPE "public"."visual_style" AS ENUM('MINIMAL', 'BOLD', 'PLAYFUL', 'CORPORATE', 'LUXURY', 'TECH');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false,
	"name" text,
	"image" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"subscription_id" text,
	"amount" integer NOT NULL,
	"action" "credit_action" NOT NULL,
	"description" text,
	"related_post_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "member_role" DEFAULT 'MEMBER' NOT NULL,
	"invited_at" timestamp,
	"joined_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "organization_members_organization_id_user_id_unique" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"stripe_customer_id" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"tier" "subscription_tier" DEFAULT 'FREE' NOT NULL,
	"status" "subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"credits_total" integer DEFAULT 0 NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"stripe_subscription_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "subscriptions_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "brand_profile_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_profile_id" text NOT NULL,
	"social_account_id" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "brand_profile_accounts_brand_profile_id_social_account_id_unique" UNIQUE("brand_profile_id","social_account_id")
);
--> statement-breakpoint
CREATE TABLE "brand_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"logo" text,
	"icon" text,
	"colors" jsonb DEFAULT '{}'::jsonb,
	"visual_style" "visual_style" DEFAULT 'MINIMAL',
	"font_preference" "font_preference" DEFAULT 'MODERN',
	"tone" text[] DEFAULT '{}',
	"personality" text,
	"language_rules" jsonb DEFAULT '{}'::jsonb,
	"example_posts" jsonb DEFAULT '[]'::jsonb,
	"custom_context" text,
	"target_audience" text,
	"content_pillars" jsonb DEFAULT '[]'::jsonb,
	"platform_settings" jsonb DEFAULT '{}'::jsonb,
	"auto_approve" boolean DEFAULT true,
	"notify_email" text,
	"notify_webhook" text,
	"approval_timeout" integer DEFAULT 24,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_profile_id" text NOT NULL,
	"name" text,
	"platforms" "social_platform"[] DEFAULT '{}',
	"frequency" text DEFAULT '1_per_day' NOT NULL,
	"times" text[] DEFAULT '{}',
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"days_of_week" integer[] DEFAULT '{1,2,3,4,5}',
	"material_strategy" text DEFAULT 'round_robin',
	"auto_approve" boolean DEFAULT true,
	"unique_per_platform" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"next_run_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"platform" "social_platform" NOT NULL,
	"account_id" text NOT NULL,
	"account_name" text NOT NULL,
	"account_type" text,
	"profile_url" text,
	"avatar_url" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "social_accounts_platform_account_id_unique" UNIQUE("platform","account_id")
);
--> statement-breakpoint
CREATE TABLE "external_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"brand_profile_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"store_url" text,
	"connection_config" jsonb DEFAULT '{}'::jsonb,
	"last_crawl_at" timestamp,
	"crawl_frequency" text DEFAULT '0 0 * * *',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"brand_profile_id" text,
	"type" "material_type" NOT NULL,
	"name" text,
	"original_content" text,
	"file_key" text,
	"file_size" integer,
	"mime_type" text,
	"url" text,
	"summary" text,
	"key_points" text[] DEFAULT '{}',
	"keywords" text[] DEFAULT '{}',
	"suggested_angles" "content_angle"[] DEFAULT '{}',
	"sentiment" text,
	"content_pillar" text,
	"status" "material_status" DEFAULT 'UPLOADED',
	"usage_count" integer DEFAULT 0,
	"last_used_at" timestamp,
	"embedding_id" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pending_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"brand_profile_id" text NOT NULL,
	"material_id" text NOT NULL,
	"schedule_id" text,
	"platforms" "social_platform"[] NOT NULL,
	"content" text NOT NULL,
	"hashtags" text[] DEFAULT '{}',
	"media_urls" text[] DEFAULT '{}',
	"angle" "content_angle" NOT NULL,
	"angle_reason" text,
	"generation_mode" text DEFAULT 'autopilot' NOT NULL,
	"scheduled_for" timestamp,
	"expires_at" timestamp,
	"status" "pending_post_status" DEFAULT 'PENDING' NOT NULL,
	"embedding_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"brand_profile_id" text NOT NULL,
	"social_account_id" text NOT NULL,
	"material_id" text,
	"schedule_id" text,
	"pending_post_id" text,
	"content" text NOT NULL,
	"hashtags" text[] DEFAULT '{}',
	"media_urls" text[] DEFAULT '{}',
	"platform" "social_platform" NOT NULL,
	"external_id" text,
	"external_url" text,
	"published_at" timestamp,
	"angle" "content_angle" NOT NULL,
	"angle_reason" text,
	"is_exploration" boolean DEFAULT false,
	"likes" integer DEFAULT 0,
	"comments" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"impressions" integer DEFAULT 0,
	"reach" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"engagement_rate" real,
	"metrics_updated_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"content_type" "content_type" NOT NULL,
	"content_id" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "content_embeddings_content_type_content_id_unique" UNIQUE("content_type","content_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_profile_accounts" ADD CONSTRAINT "brand_profile_accounts_brand_profile_id_brand_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."brand_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_profile_accounts" ADD CONSTRAINT "brand_profile_accounts_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_brand_profile_id_brand_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."brand_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_sources" ADD CONSTRAINT "external_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_sources" ADD CONSTRAINT "external_sources_brand_profile_id_brand_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."brand_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_brand_profile_id_brand_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."brand_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_posts" ADD CONSTRAINT "pending_posts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_posts" ADD CONSTRAINT "pending_posts_brand_profile_id_brand_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."brand_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_posts" ADD CONSTRAINT "pending_posts_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_posts" ADD CONSTRAINT "pending_posts_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_brand_profile_id_brand_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."brand_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_pending_post_id_pending_posts_id_fk" FOREIGN KEY ("pending_post_id") REFERENCES "public"."pending_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_embeddings" ADD CONSTRAINT "content_embeddings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "embedding_idx" ON "content_embeddings" USING ivfflat ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "embedding_org_idx" ON "content_embeddings" USING btree ("organization_id");