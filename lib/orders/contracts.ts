import { z } from "zod";
import { eventSchema } from "@/lib/domain/event";

export const createJobOrderSchema = z.object({
  customerId: z.string().uuid(),
  assignedDesignerId: z.string().uuid().nullable().default(null),
  packageId: z.string().uuid(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Currency must be a three-letter ISO code"),
  quotedAmountMinor: z.number().int().nonnegative().safe(),
  depositRequiredMinor: z.number().int().nonnegative().safe(),
  dueDate: z.string().date().nullable().default(null),
  collectionKey: z.enum(["midnight-garden", "luminous-parchment"]).default("midnight-garden"),
  event: eventSchema,
}).strict().superRefine((value, context) => {
  if (value.depositRequiredMinor > value.quotedAmountMinor) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Deposit cannot exceed the quoted amount",
      path: ["depositRequiredMinor"],
    });
  }
});

export type CreateJobOrderInput = z.input<typeof createJobOrderSchema>;
