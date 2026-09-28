import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { operationalLog } from "@/lib/operations/logger";

export type CommerceStage = "PRODUCT_VIEW" | "CHECKOUT_STARTED" | "PAID" | "REFUNDED" | "QUOTE_REQUESTED";
export type CommerceMetricTier = "ALL" | "ESSENTIAL" | "SIGNATURE" | "COUTURE";

export function commerceMetricIncrement(productSlug: string, tier: CommerceMetricTier, stage: CommerceStage) {
  return sql`insert into commerce_daily_metrics (day, product_slug, tier, stage, count)
    values ((now() at time zone 'Asia/Manila')::date, ${productSlug}, ${tier}, ${stage}, 1)
    on conflict (day, product_slug, tier, stage)
    do update set count = commerce_daily_metrics.count + 1`;
}

export async function recordCommerceMetric(productSlug: string, tier: CommerceMetricTier, stage: CommerceStage) {
  if (process.env.COMMERCE_ANALYTICS_ENABLED !== "true") return;
  try { await getDb().execute(commerceMetricIncrement(productSlug, tier, stage)); }
  catch { operationalLog("error", "commerce.metric.failed", { stage, productSlug, tier }); }
}
