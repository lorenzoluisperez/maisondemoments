CREATE TABLE "review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_request_id" uuid NOT NULL,
	"section_key" text NOT NULL,
	"message" text NOT NULL,
	"display_order" integer NOT NULL,
	CONSTRAINT "review_item_values_valid" CHECK ("review_items"."section_key" ~ '^[a-z][a-z0-9-]{0,79}$' AND char_length("review_items"."message") BETWEEN 1 AND 1200 AND "review_items"."display_order" >= 0)
);
--> statement-breakpoint
DROP INDEX "review_requests_version_idx";--> statement-breakpoint
ALTER TABLE "invitation_versions" ADD COLUMN "material_changes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_review_request_id_review_requests_id_fk" FOREIGN KEY ("review_request_id") REFERENCES "public"."review_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "review_item_order_unique" ON "review_items" USING btree ("review_request_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "review_requests_version_unique" ON "review_requests" USING btree ("version_id");--> statement-breakpoint
ALTER TABLE "invitation_versions" ADD CONSTRAINT "invitation_version_values_valid" CHECK ("invitation_versions"."version" > 0 AND "invitation_versions"."source_revision" > 0 AND "invitation_versions"."content_hash" ~ '^[0-9a-f]{64}$');