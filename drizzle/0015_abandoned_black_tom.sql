CREATE TYPE "public"."media_backup_state" AS ENUM('PENDING', 'VERIFIED', 'FAILED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."notification_state" AS ENUM('PENDING', 'SENDING', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TABLE "deletion_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_order_id" uuid NOT NULL,
	"invitation_id" uuid NOT NULL,
	"slug_digest" text NOT NULL,
	"reason" text NOT NULL,
	"requested_by" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"execute_after" timestamp with time zone NOT NULL,
	"content_purged_at" timestamp with time zone,
	"tombstone_exported_at" timestamp with time zone,
	CONSTRAINT "deletion_record_values_valid" CHECK (char_length("deletion_records"."slug_digest") = 64 AND char_length(btrim("deletion_records"."reason")) BETWEEN 1 AND 500)
);
--> statement-breakpoint
CREATE TABLE "media_backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"object_prefix" text NOT NULL,
	"manifest" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state" "media_backup_state" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error_code" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_backups_media_id_unique" UNIQUE("media_id"),
	CONSTRAINT "media_backups_object_prefix_unique" UNIQUE("object_prefix"),
	CONSTRAINT "media_backup_values_valid" CHECK (char_length(btrim("media_backups"."provider")) BETWEEN 1 AND 40 AND char_length(btrim("media_backups"."object_prefix")) BETWEEN 1 AND 500 AND "media_backups"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_order_id" uuid,
	"kind" text NOT NULL,
	"recipient" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"state" "notification_state" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_message_id" text,
	"last_error_code" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_deliveries_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "notification_delivery_values_valid" CHECK (char_length(btrim("notification_deliveries"."kind")) BETWEEN 1 AND 80 AND char_length(btrim("notification_deliveries"."recipient")) BETWEEN 3 AND 320 AND "notification_deliveries"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "payment_entries" DROP CONSTRAINT "payment_nonzero";--> statement-breakpoint
ALTER TABLE "payment_entries" ADD COLUMN "idempotency_key" uuid;--> statement-breakpoint
UPDATE "payment_entries" SET "idempotency_key" = gen_random_uuid() WHERE "idempotency_key" IS NULL;--> statement-breakpoint
ALTER TABLE "payment_entries" ALTER COLUMN "idempotency_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_entries" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "media_backups" ADD CONSTRAINT "media_backups_media_id_media_objects_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_objects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_job_order_id_job_orders_id_fk" FOREIGN KEY ("job_order_id") REFERENCES "public"."job_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deletion_records_invitation_unique" ON "deletion_records" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "deletion_records_due_idx" ON "deletion_records" USING btree ("content_purged_at","execute_after");--> statement-breakpoint
CREATE INDEX "media_backups_state_idx" ON "media_backups" USING btree ("state","updated_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_order_idx" ON "notification_deliveries" USING btree ("job_order_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_state_idx" ON "notification_deliveries" USING btree ("state","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_reversal_unique" ON "payment_entries" USING btree ("reversal_of_id") WHERE "payment_entries"."reversal_of_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_external_reference_unique" ON "payment_entries" USING btree ("job_order_id","method","external_reference") WHERE "payment_entries"."external_reference" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_entries" ADD CONSTRAINT "payment_entries_idempotency_key_unique" UNIQUE("idempotency_key");--> statement-breakpoint
ALTER TABLE "payment_entries" ADD CONSTRAINT "payment_values_valid" CHECK ("payment_entries"."amount_minor" <> 0 AND "payment_entries"."currency" ~ '^[A-Z]{3}$' AND char_length(btrim("payment_entries"."method")) BETWEEN 1 AND 40 AND ("payment_entries"."note" IS NULL OR char_length("payment_entries"."note") <= 500));
