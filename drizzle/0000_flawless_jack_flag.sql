CREATE TYPE "public"."account_type" AS ENUM('CUSTOMER', 'STAFF');--> statement-breakpoint
CREATE TYPE "public"."background_job_state" AS ENUM('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('wedding', 'birthday', 'debut', 'christening');--> statement-breakpoint
CREATE TYPE "public"."guest_slot_type" AS ENUM('ADULT', 'CHILD');--> statement-breakpoint
CREATE TYPE "public"."invitation_availability" AS ENUM('UNPUBLISHED', 'LIVE', 'SUSPENDED', 'EXPIRED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."media_state" AS ENUM('QUARANTINED', 'PROCESSING', 'READY', 'REJECTED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."production_state" AS ENUM('NEW', 'COLLECTING', 'READY', 'IN_PRODUCTION', 'DELIVERED', 'CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."review_state" AS ENUM('EDITING', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED');--> statement-breakpoint
CREATE TYPE "public"."rsvp_status" AS ENUM('ATTENDING', 'DECLINED');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('DESIGNER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"type" "account_type" NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approvals_version_id_unique" UNIQUE("version_id")
);
--> statement-breakpoint
CREATE TABLE "artwork_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"key" text NOT NULL,
	"original_media_id" uuid NOT NULL,
	"metadata" jsonb NOT NULL,
	"reuse_scope" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artwork_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "artwork_collections_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_account_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "background_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"state" "background_job_state" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"leased_until" timestamp with time zone,
	"last_error_code" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "background_jobs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "event_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"venue_name" text NOT NULL,
	"address" text NOT NULL,
	"map_url" text NOT NULL,
	"display_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"module_key" text NOT NULL,
	"schema_version" integer NOT NULL,
	"content" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"group_key" text NOT NULL,
	"role_label" text NOT NULL,
	"display_name" text NOT NULL,
	"display_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_order_id" uuid NOT NULL,
	"type" "event_type" NOT NULL,
	"timezone" text NOT NULL,
	"primary_local_date" date NOT NULL,
	"rsvp_deadline" date NOT NULL,
	"schema_version" integer NOT NULL,
	"details" jsonb NOT NULL,
	"content_revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "events_job_order_id_unique" UNIQUE("job_order_id"),
	CONSTRAINT "rsvp_deadline_before_event" CHECK ("events"."rsvp_deadline" <= "events"."primary_local_date")
);
--> statement-breakpoint
CREATE TABLE "guest_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"label" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"token_digest" text NOT NULL,
	"encrypted_token" text NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "guest_links_token_digest_unique" UNIQUE("token_digest")
);
--> statement-breakpoint
CREATE TABLE "guest_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"link_generation" integer NOT NULL,
	"session_digest" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "guest_sessions_session_digest_unique" UNIQUE("session_digest")
);
--> statement-breakpoint
CREATE TABLE "guest_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"type" "guest_slot_type" NOT NULL,
	"assigned_name" text,
	"is_additional_guest" boolean DEFAULT false NOT NULL,
	"display_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation_drafts" (
	"invitation_id" uuid PRIMARY KEY NOT NULL,
	"theme_version_id" uuid NOT NULL,
	"configuration" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"review_state" "review_state" DEFAULT 'EDITING' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"source_revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"renderer_version" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_order_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"live_version_id" uuid,
	"availability" "invitation_availability" DEFAULT 'UNPUBLISHED' NOT NULL,
	"access_epoch" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "invitations_job_order_id_unique" UNIQUE("job_order_id"),
	CONSTRAINT "invitations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "job_order_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_number" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"assigned_designer_id" uuid,
	"package_id" uuid NOT NULL,
	"state" "production_state" DEFAULT 'NEW' NOT NULL,
	"currency" text NOT NULL,
	"quoted_amount_minor" bigint NOT NULL,
	"deposit_required_minor" bigint NOT NULL,
	"due_date" date,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_orders_job_number_unique" UNIQUE("job_number"),
	CONSTRAINT "job_order_amounts_nonnegative" CHECK ("job_orders"."quoted_amount_minor" >= 0 AND "job_orders"."deposit_required_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "media_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_account_id" uuid,
	"job_order_id" uuid,
	"storage_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"detected_content_type" text,
	"bytes" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"checksum" text,
	"state" "media_state" DEFAULT 'QUARANTINED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_objects_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "media_bytes_nonnegative" CHECK ("media_objects"."bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "media_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_media_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"format" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" bigint NOT NULL,
	"recipe_version" integer NOT NULL,
	CONSTRAINT "media_variants_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"terms_snapshot" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "packages_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payment_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_order_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"method" text NOT NULL,
	"external_reference" text,
	"confirmed_by" uuid NOT NULL,
	"reversal_of_id" uuid,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_nonzero" CHECK ("payment_entries"."amount_minor" <> 0)
);
--> statement-breakpoint
CREATE TABLE "review_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rsvp_attendees" (
	"rsvp_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	CONSTRAINT "rsvp_attendees_rsvp_id_slot_id_pk" PRIMARY KEY("rsvp_id","slot_id")
);
--> statement-breakpoint
CREATE TABLE "rsvps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"status" "rsvp_status" NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"submitted_invitation_version" integer NOT NULL,
	"note" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rsvps_group_id_unique" UNIQUE("group_id")
);
--> statement-breakpoint
CREATE TABLE "staff_memberships" (
	"account_id" uuid NOT NULL,
	"role" "staff_role" NOT NULL,
	CONSTRAINT "staff_memberships_account_id_role_pk" PRIMARY KEY("account_id","role")
);
--> statement-breakpoint
CREATE TABLE "theme_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"theme_id" uuid NOT NULL,
	"version" text NOT NULL,
	"schema_compatibility" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"released_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "themes_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "version_media_refs" (
	"version_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	CONSTRAINT "version_media_refs_version_id_media_id_pk" PRIMARY KEY("version_id","media_id")
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_version_id_invitation_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."invitation_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_customer_id_accounts_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_assets" ADD CONSTRAINT "artwork_assets_collection_id_artwork_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."artwork_collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_assets" ADD CONSTRAINT "artwork_assets_original_media_id_media_objects_id_fk" FOREIGN KEY ("original_media_id") REFERENCES "public"."media_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_activities" ADD CONSTRAINT "event_activities_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_content" ADD CONSTRAINT "event_content_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_job_order_id_job_orders_id_fk" FOREIGN KEY ("job_order_id") REFERENCES "public"."job_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_groups" ADD CONSTRAINT "guest_groups_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_links" ADD CONSTRAINT "guest_links_group_id_guest_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."guest_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_group_id_guest_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."guest_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_slots" ADD CONSTRAINT "guest_slots_group_id_guest_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."guest_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_drafts" ADD CONSTRAINT "invitation_drafts_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_drafts" ADD CONSTRAINT "invitation_drafts_theme_version_id_theme_versions_id_fk" FOREIGN KEY ("theme_version_id") REFERENCES "public"."theme_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_versions" ADD CONSTRAINT "invitation_versions_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_versions" ADD CONSTRAINT "invitation_versions_created_by_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_job_order_id_job_orders_id_fk" FOREIGN KEY ("job_order_id") REFERENCES "public"."job_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_customer_id_accounts_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_assigned_designer_id_accounts_id_fk" FOREIGN KEY ("assigned_designer_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_owner_account_id_accounts_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_job_order_id_job_orders_id_fk" FOREIGN KEY ("job_order_id") REFERENCES "public"."job_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_variants" ADD CONSTRAINT "media_variants_source_media_id_media_objects_id_fk" FOREIGN KEY ("source_media_id") REFERENCES "public"."media_objects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_entries" ADD CONSTRAINT "payment_entries_job_order_id_job_orders_id_fk" FOREIGN KEY ("job_order_id") REFERENCES "public"."job_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_entries" ADD CONSTRAINT "payment_entries_confirmed_by_accounts_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_version_id_invitation_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."invitation_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_requested_by_accounts_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_attendees" ADD CONSTRAINT "rsvp_attendees_rsvp_id_rsvps_id_fk" FOREIGN KEY ("rsvp_id") REFERENCES "public"."rsvps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_attendees" ADD CONSTRAINT "rsvp_attendees_slot_id_guest_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."guest_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_group_id_guest_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."guest_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_memberships" ADD CONSTRAINT "staff_memberships_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_versions" ADD CONSTRAINT "theme_versions_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_media_refs" ADD CONSTRAINT "version_media_refs_version_id_invitation_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."invitation_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_media_refs" ADD CONSTRAINT "version_media_refs_media_id_media_objects_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "artwork_asset_key_unique" ON "artwork_assets" USING btree ("collection_id","key");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "background_jobs_claim_idx" ON "background_jobs" USING btree ("state","available_at","leased_until");--> statement-breakpoint
CREATE UNIQUE INDEX "event_activity_order_unique" ON "event_activities" USING btree ("event_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "event_content_unique" ON "event_content" USING btree ("event_id","module_key");--> statement-breakpoint
CREATE INDEX "event_participants_idx" ON "event_participants" USING btree ("event_id","group_key","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_slot_order_unique" ON "guest_slots" USING btree ("group_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_version_unique" ON "invitation_versions" USING btree ("invitation_id","version");--> statement-breakpoint
CREATE INDEX "job_orders_queue_idx" ON "job_orders" USING btree ("state","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "theme_version_unique" ON "theme_versions" USING btree ("theme_id","version");