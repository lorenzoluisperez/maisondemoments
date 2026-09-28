CREATE TABLE "commerce_daily_metrics" (
	"day" date NOT NULL,
	"product_slug" text NOT NULL,
	"tier" text DEFAULT 'ALL' NOT NULL,
	"stage" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "commerce_daily_metrics_day_product_slug_tier_stage_pk" PRIMARY KEY("day","product_slug","tier","stage"),
	CONSTRAINT "commerce_metric_valid" CHECK ("commerce_daily_metrics"."tier" IN ('ALL', 'ESSENTIAL', 'SIGNATURE', 'COUTURE') AND "commerce_daily_metrics"."stage" IN ('PRODUCT_VIEW', 'CHECKOUT_STARTED', 'PAID', 'REFUNDED', 'QUOTE_REQUESTED') AND "commerce_daily_metrics"."count" >= 0)
);
--> statement-breakpoint
REVOKE ALL ON TABLE public.commerce_daily_metrics FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE public.commerce_daily_metrics TO maison_app, service_role;
--> statement-breakpoint
ALTER TABLE public.commerce_daily_metrics ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY maison_app_server_access ON public.commerce_daily_metrics FOR ALL TO maison_app USING (true) WITH CHECK (true);
