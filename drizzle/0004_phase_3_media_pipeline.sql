CREATE TYPE "public"."media_usage" AS ENUM('CUSTOMER_IMAGE', 'EXCLUSIVE_ARTWORK', 'CATALOG_ARTWORK');--> statement-breakpoint
ALTER TABLE "media_objects" ADD COLUMN "usage" "media_usage" DEFAULT 'CUSTOMER_IMAGE' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_objects" ADD COLUMN "bucket" text NOT NULL;--> statement-breakpoint
ALTER TABLE "media_objects" ADD COLUMN "quarantine_storage_key" text;--> statement-breakpoint
ALTER TABLE "media_objects" ADD COLUMN "upload_intent_key" uuid;--> statement-breakpoint
ALTER TABLE "media_objects" ADD COLUMN "claimed_content_type" text;--> statement-breakpoint
ALTER TABLE "media_objects" ADD COLUMN "failure_code" text;--> statement-breakpoint
ALTER TABLE "media_objects" ADD COLUMN "processing_recipe_version" integer;--> statement-breakpoint
ALTER TABLE "media_objects" ADD COLUMN "finalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_objects" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_objects" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "media_variants" ADD COLUMN "bucket" text NOT NULL;--> statement-breakpoint
ALTER TABLE "media_variants" ADD COLUMN "content_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "media_variants" ADD COLUMN "checksum" text NOT NULL;--> statement-breakpoint
ALTER TABLE "media_variants" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "media_objects_cleanup_idx" ON "media_objects" USING btree ("state","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "media_variant_recipe_unique" ON "media_variants" USING btree ("source_media_id","recipe_version","width","format");--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_upload_intent_key_unique" UNIQUE("upload_intent_key");--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_dimensions_together" CHECK (("media_objects"."width" IS NULL AND "media_objects"."height" IS NULL) OR ("media_objects"."width" > 0 AND "media_objects"."height" > 0));--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_customer_ownership" CHECK ("media_objects"."usage" = 'CATALOG_ARTWORK' OR ("media_objects"."owner_account_id" IS NOT NULL AND "media_objects"."job_order_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "media_variants" ADD CONSTRAINT "media_variant_values_valid" CHECK ("media_variants"."width" > 0 AND "media_variants"."height" > 0 AND "media_variants"."bytes" > 0 AND "media_variants"."recipe_version" > 0);
