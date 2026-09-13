ALTER TABLE "job_orders" DROP CONSTRAINT "job_order_amounts_nonnegative";--> statement-breakpoint
CREATE INDEX "approvals_customer_idx" ON "approvals" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "artwork_assets_original_media_idx" ON "artwork_assets" USING btree ("original_media_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_events" USING btree ("actor_account_id");--> statement-breakpoint
CREATE INDEX "guest_groups_invitation_idx" ON "guest_groups" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "guest_links_group_idx" ON "guest_links" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "guest_sessions_group_idx" ON "guest_sessions" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "invitation_drafts_theme_version_idx" ON "invitation_drafts" USING btree ("theme_version_id");--> statement-breakpoint
CREATE INDEX "invitation_versions_creator_idx" ON "invitation_versions" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "invitations_live_version_idx" ON "invitations" USING btree ("live_version_id");--> statement-breakpoint
CREATE INDEX "job_orders_customer_idx" ON "job_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "job_orders_designer_idx" ON "job_orders" USING btree ("assigned_designer_id");--> statement-breakpoint
CREATE INDEX "job_orders_package_idx" ON "job_orders" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "media_objects_owner_idx" ON "media_objects" USING btree ("owner_account_id");--> statement-breakpoint
CREATE INDEX "media_objects_order_idx" ON "media_objects" USING btree ("job_order_id");--> statement-breakpoint
CREATE INDEX "media_variants_source_idx" ON "media_variants" USING btree ("source_media_id");--> statement-breakpoint
CREATE INDEX "payment_entries_order_idx" ON "payment_entries" USING btree ("job_order_id");--> statement-breakpoint
CREATE INDEX "payment_entries_confirmer_idx" ON "payment_entries" USING btree ("confirmed_by");--> statement-breakpoint
CREATE INDEX "payment_entries_reversal_idx" ON "payment_entries" USING btree ("reversal_of_id");--> statement-breakpoint
CREATE INDEX "review_requests_version_idx" ON "review_requests" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "review_requests_requester_idx" ON "review_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "rsvp_attendees_slot_idx" ON "rsvp_attendees" USING btree ("slot_id");--> statement-breakpoint
CREATE INDEX "version_media_refs_media_idx" ON "version_media_refs" USING btree ("media_id");--> statement-breakpoint
ALTER TABLE "job_orders" ADD CONSTRAINT "job_order_amounts_valid" CHECK ("job_orders"."quoted_amount_minor" >= 0 AND "job_orders"."deposit_required_minor" >= 0 AND "job_orders"."deposit_required_minor" <= "job_orders"."quoted_amount_minor");--> statement-breakpoint
ALTER TABLE "job_orders" ADD CONSTRAINT "job_order_currency_iso" CHECK ("job_orders"."currency" ~ '^[A-Z]{3}$');