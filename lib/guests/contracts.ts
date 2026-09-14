import { z } from "zod";

const slotSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(["ADULT", "CHILD"]),
  assignedName: z.string().trim().min(1).max(120).nullable().default(null),
  isAdditionalGuest: z.boolean().default(false),
}).strict();

export const createHouseholdSchema = z.object({
  label: z.string().trim().min(1).max(160),
  slots: z.array(slotSchema).min(1).max(20),
}).strict();

export const updateHouseholdSchema = createHouseholdSchema.extend({
  expectedRevision: z.number().int().positive(),
  active: z.boolean().default(true),
}).strict();

export const importHouseholdsSchema = z.object({ csv: z.string().min(1).max(100_000) }).strict();
export const rotateLinkSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();
export const revokeLinkSchema = rotateLinkSchema;
export const guestExchangeSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  token: z.string().min(32).max(200),
  website: z.string().max(0).optional(),
}).strict();
export const adminCorrectionSchema = z.object({
  status: z.enum(["ATTENDING", "DECLINED"]),
  selectedSlotIds: z.array(z.string().uuid()).max(20),
  attendeeNames: z.record(z.string().uuid(), z.string().trim().min(1).max(120)).default({}),
  note: z.string().trim().max(500).optional(),
  reason: z.string().trim().min(3).max(500),
}).strict();

export type HouseholdSlotInput = z.infer<typeof slotSchema>;
