ALTER TABLE "job_orders" ADD COLUMN "package_terms_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "job_orders" AS order_row
SET "package_terms_snapshot" = package_row."terms_snapshot"
FROM "packages" AS package_row
WHERE package_row."id" = order_row."package_id";
