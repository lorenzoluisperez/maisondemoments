import { z } from "zod";

export const productionCostSchema = z.object({
  category: z.enum(["LABOR", "ARTWORK", "PAYMENT_FEE", "OTHER"]),
  minutes: z.number().int().min(1).max(1440).nullable(),
  amountMinor: z.number().int().min(0).max(100_000_000),
  note: z.string().trim().min(1).max(500),
}).strict().refine((value) => (value.category === "LABOR") === (value.minutes !== null), { message: "Hours are required only for labor" });

export const productionCostVoidSchema = z.object({ reason: z.string().trim().min(5).max(300) }).strict();
