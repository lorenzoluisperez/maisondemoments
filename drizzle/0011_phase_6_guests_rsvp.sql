CREATE TABLE "guest_rate_limits" (
	"key_digest" text NOT NULL,
	"action" text NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "guest_rate_limits_key_digest_action_window_started_at_pk" PRIMARY KEY("key_digest","action","window_started_at"),
	CONSTRAINT "guest_rate_limit_values_valid" CHECK ("guest_rate_limits"."attempts" > 0 AND char_length("guest_rate_limits"."action") BETWEEN 1 AND 40)
);
--> statement-breakpoint
DROP INDEX "rsvp_attendees_slot_idx";--> statement-breakpoint
ALTER TABLE "guest_groups" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_groups" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_links" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_sessions" ADD COLUMN "invitation_access_epoch" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_sessions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "rsvp_attendees" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "last_idempotency_key" uuid NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "guest_links_active_group_unique" ON "guest_links" USING btree ("group_id") WHERE "guest_links"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rsvp_attendees_slot_unique" ON "rsvp_attendees" USING btree ("slot_id");--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_last_idempotency_key_unique" UNIQUE("last_idempotency_key");--> statement-breakpoint
ALTER TABLE "guest_groups" ADD CONSTRAINT "guest_group_values_valid" CHECK (char_length(btrim("guest_groups"."label")) BETWEEN 1 AND 160 AND "guest_groups"."revision" > 0);--> statement-breakpoint
ALTER TABLE "guest_links" ADD CONSTRAINT "guest_link_generation_positive" CHECK ("guest_links"."generation" > 0);--> statement-breakpoint
ALTER TABLE "guest_slots" ADD CONSTRAINT "guest_slot_values_valid" CHECK ("guest_slots"."display_order" >= 0 AND ("guest_slots"."assigned_name" IS NULL OR char_length(btrim("guest_slots"."assigned_name")) BETWEEN 1 AND 120));--> statement-breakpoint
ALTER TABLE "rsvp_attendees" ADD CONSTRAINT "rsvp_attendee_name_valid" CHECK ("rsvp_attendees"."display_name" IS NULL OR char_length(btrim("rsvp_attendees"."display_name")) BETWEEN 1 AND 120);--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvp_values_valid" CHECK ("rsvps"."revision" > 0 AND "rsvps"."submitted_invitation_version" > 0 AND ("rsvps"."note" IS NULL OR char_length("rsvps"."note") <= 500));