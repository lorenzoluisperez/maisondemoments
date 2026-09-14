import { z } from "zod";

export const recordPaymentSchema = z.object({
  amountMinor: z.number().int().positive().max(100_000_000),
  method: z.string().trim().min(1).max(40),
  externalReference: z.string().trim().min(1).max(160).optional(),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().uuid(),
}).strict();

export const reversePaymentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().uuid(),
}).strict();
