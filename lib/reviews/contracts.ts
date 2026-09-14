import { z } from "zod";

export const reviewSectionSchema = z.enum(["general", "opening", "welcome", "details", "participants", "rsvp"]);

export const createReviewVersionSchema = z.object({
  expectedRevision: z.number().int().positive(),
  checklist: z.object({
    contentVerified: z.literal(true),
    responsiveChecked: z.literal(true),
    accessibilityChecked: z.literal(true),
    mediaChecked: z.literal(true),
  }).strict(),
}).strict();

export const requestChangesSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  items: z.array(z.object({
    sectionKey: reviewSectionSchema,
    message: z.string().trim().min(1).max(1200),
  }).strict()).min(1).max(30),
}).strict();

export const publishVersionSchema = z.object({ versionId: z.string().uuid() }).strict();
export const availabilityActionSchema = z.object({
  action: z.enum(["suspend", "resume", "expire"]),
  reason: z.string().trim().min(3).max(500),
}).strict();

export const materialChangeSchema = z.object({
  kind: z.enum(["initial", "identity", "date", "deadline", "schedule", "participants", "content", "media", "design"]),
  label: z.string().min(1).max(160),
}).strict();
export const materialChangesSchema = z.array(materialChangeSchema).max(12);

export type MaterialChange = z.infer<typeof materialChangeSchema>;
