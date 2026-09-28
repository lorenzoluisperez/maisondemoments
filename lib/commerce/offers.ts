import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { productOffers } from "@/db/schema";
import { weddingProduct, type ProductTier } from "@/lib/products/catalog";
import { commerceReady } from "@/lib/commerce/purchases";

export async function listPublicOffers(slug: string) {
  if (!weddingProduct(slug) || !process.env.DATABASE_URL || !commerceReady()) return [];
  try { return await getDb().select({
    tier: productOffers.tier,
    priceMinor: productOffers.priceMinor,
    turnaroundDays: productOffers.turnaroundDays,
    enabled: productOffers.enabled,
  }).from(productOffers).where(eq(productOffers.productSlug, slug)); }
  catch { return []; }
}

export async function getEnabledOffer(slug: string, tier: ProductTier) {
  if (!weddingProduct(slug) || tier === "COUTURE" || !commerceReady()) return null;
  try { const [offer] = await getDb().select().from(productOffers).where(and(
    eq(productOffers.productSlug, slug),
    eq(productOffers.tier, tier),
    eq(productOffers.enabled, true),
  )).limit(1);
  return offer?.priceMinor && offer.turnaroundDays ? offer : null; }
  catch { return null; }
}
