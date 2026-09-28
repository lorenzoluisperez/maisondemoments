CREATE TABLE "checkout_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"provider_session_id" text,
	"provider_payment_id" text,
	"reference" text NOT NULL,
	"state" text DEFAULT 'CREATING' NOT NULL,
	"checkout_url" text,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'PHP' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkout_attempts_provider_session_id_unique" UNIQUE("provider_session_id"),
	CONSTRAINT "checkout_attempts_provider_payment_id_unique" UNIQUE("provider_payment_id"),
	CONSTRAINT "checkout_attempts_reference_unique" UNIQUE("reference"),
	CONSTRAINT "checkout_attempt_state_valid" CHECK ("checkout_attempts"."state" IN ('CREATING', 'OPEN', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'))
);
--> statement-breakpoint
CREATE TABLE "couture_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_slug" text NOT NULL,
	"request" text NOT NULL,
	"scope" text,
	"exclusions" text,
	"revision_rounds" integer,
	"delivery_days" integer,
	"price_minor" bigint,
	"state" text DEFAULT 'REQUESTED' NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "couture_quote_state_valid" CHECK ("couture_quotes"."state" IN ('REQUESTED', 'OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED'))
);
--> statement-breakpoint
CREATE TABLE "product_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_slug" text NOT NULL,
	"tier" text NOT NULL,
	"price_minor" bigint,
	"turnaround_days" integer,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_offer_tier_valid" CHECK ("product_offers"."tier" IN ('ESSENTIAL', 'SIGNATURE')),
	CONSTRAINT "product_offer_price_valid" CHECK (("product_offers"."price_minor" IS NULL OR "product_offers"."price_minor" > 0) AND ("product_offers"."turnaround_days" IS NULL OR "product_offers"."turnaround_days" > 0))
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_slug" text NOT NULL,
	"tier" text NOT NULL,
	"quote_id" uuid,
	"event_date" date NOT NULL,
	"timezone" text NOT NULL,
	"contact_name" text NOT NULL,
	"price_minor" bigint NOT NULL,
	"currency" text DEFAULT 'PHP' NOT NULL,
	"terms_snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'AWAITING_PAYMENT' NOT NULL,
	"paid_at" timestamp with time zone,
	"brief" jsonb,
	"brief_revision" integer DEFAULT 1 NOT NULL,
	"job_order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_quote_id_unique" UNIQUE("quote_id"),
	CONSTRAINT "purchases_job_order_id_unique" UNIQUE("job_order_id"),
	CONSTRAINT "purchase_status_valid" CHECK ("purchases"."status" IN ('AWAITING_PAYMENT', 'PAID', 'ORDER_CREATED', 'CANCELLED', 'REFUNDED')),
	CONSTRAINT "purchase_tier_valid" CHECK ("purchases"."tier" IN ('ESSENTIAL', 'SIGNATURE', 'COUTURE')),
	CONSTRAINT "purchase_price_valid" CHECK ("purchases"."price_minor" > 0 AND "purchases"."currency" = 'PHP' AND "purchases"."brief_revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "job_orders" ADD COLUMN "product_slug" text;--> statement-breakpoint
ALTER TABLE "checkout_attempts" ADD CONSTRAINT "checkout_attempts_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "couture_quotes" ADD CONSTRAINT "couture_quotes_customer_id_accounts_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_customer_id_accounts_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_quote_id_couture_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."couture_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_job_order_id_job_orders_id_fk" FOREIGN KEY ("job_order_id") REFERENCES "public"."job_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkout_attempt_purchase_idx" ON "checkout_attempts" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "couture_quotes_customer_idx" ON "couture_quotes" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_offer_unique" ON "product_offers" USING btree ("product_slug","tier");--> statement-breakpoint
CREATE INDEX "purchases_customer_idx" ON "purchases" USING btree ("customer_id");
--> statement-breakpoint
REVOKE ALL ON TABLE public.checkout_attempts, public.couture_quotes, public.product_offers, public.purchases FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.checkout_attempts, public.couture_quotes, public.product_offers, public.purchases TO maison_app, service_role;
--> statement-breakpoint
ALTER TABLE public.checkout_attempts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.couture_quotes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.product_offers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY maison_app_server_access ON public.checkout_attempts FOR ALL TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY maison_app_server_access ON public.couture_quotes FOR ALL TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY maison_app_server_access ON public.product_offers FOR ALL TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY maison_app_server_access ON public.purchases FOR ALL TO maison_app USING (true) WITH CHECK (true);
