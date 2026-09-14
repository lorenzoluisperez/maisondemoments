CREATE TABLE "event_briefs" (
	"job_order_id" uuid PRIMARY KEY NOT NULL,
	"event_type" "event_type" NOT NULL,
	"document" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"submitted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_brief_revision_positive" CHECK ("event_briefs"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "job_orders" ADD COLUMN "collection_key" text DEFAULT 'midnight-garden' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_briefs" ADD CONSTRAINT "event_briefs_job_order_id_job_orders_id_fk" FOREIGN KEY ("job_order_id") REFERENCES "public"."job_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_orders" ADD CONSTRAINT "job_order_collection_supported" CHECK ("job_orders"."collection_key" IN ('midnight-garden', 'luminous-parchment'));
