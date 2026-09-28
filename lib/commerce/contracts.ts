import { z } from "zod";

export const purchaseInputSchema = z.object({
  productSlug: z.enum(["garden-romance", "coastal-romance", "heritage-romance"]),
  tier: z.enum(["ESSENTIAL", "SIGNATURE"]),
  eventDate: z.string().date(),
  timezone: z.string().min(1).max(80).refine((zone) => { try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; } catch { return false; } }, "Invalid timezone"),
  contactName: z.string().trim().min(2).max(160),
  acceptedTerms: z.literal(true),
}).strict();

export const quoteRequestSchema = z.object({
  productSlug: z.enum(["garden-romance", "coastal-romance", "heritage-romance"]),
  request: z.string().trim().min(30).max(6000),
}).strict();

export const quoteOfferSchema = z.object({
  scope: z.string().trim().min(30).max(6000),
  exclusions: z.string().trim().min(10).max(3000),
  revisionRounds: z.number().int().min(1).max(5),
  deliveryDays: z.number().int().min(1).max(365),
  priceMinor: z.number().int().min(100).max(999_999_900),
}).strict();

export const offerUpdateSchema = z.object({
  productSlug: purchaseInputSchema.shape.productSlug,
  tier: purchaseInputSchema.shape.tier,
  priceMinor: z.number().int().min(100).max(999_999_900).nullable(),
  turnaroundDays: z.number().int().min(1).max(365).nullable(),
  enabled: z.boolean(),
}).strict().refine((offer) => !offer.enabled || Boolean(offer.priceMinor && offer.turnaroundDays), "Set price and delivery time before making a tier available");
