CREATE TABLE "production_cost_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"category" text NOT NULL,
	"minutes" integer,
	"amount_minor" bigint NOT NULL,
	"note" text NOT NULL,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	CONSTRAINT "production_cost_valid" CHECK ("production_cost_entries"."category" IN ('LABOR', 'ARTWORK', 'PAYMENT_FEE', 'OTHER') AND "production_cost_entries"."amount_minor" >= 0 AND char_length(btrim("production_cost_entries"."note")) BETWEEN 1 AND 500 AND (("production_cost_entries"."category" = 'LABOR' AND "production_cost_entries"."minutes" BETWEEN 1 AND 1440) OR ("production_cost_entries"."category" <> 'LABOR' AND "production_cost_entries"."minutes" IS NULL)) AND (("production_cost_entries"."voided_at" IS NULL AND "production_cost_entries"."voided_by" IS NULL) OR ("production_cost_entries"."voided_at" IS NOT NULL AND "production_cost_entries"."voided_by" IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "production_cost_entries" ADD CONSTRAINT "production_cost_entries_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_cost_entries" ADD CONSTRAINT "production_cost_entries_recorded_by_accounts_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_cost_entries" ADD CONSTRAINT "production_cost_entries_voided_by_accounts_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "production_cost_purchase_idx" ON "production_cost_entries" USING btree ("purchase_id");
--> statement-breakpoint
REVOKE ALL ON TABLE public.production_cost_entries FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE public.production_cost_entries TO maison_app, service_role;
--> statement-breakpoint
ALTER TABLE public.production_cost_entries ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY maison_app_server_access ON public.production_cost_entries FOR ALL TO maison_app USING (true) WITH CHECK (true);
