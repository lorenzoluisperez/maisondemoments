import { z } from "zod";

const normalizedRectangleSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
}).strict().refine((value) => value.x + value.width <= 1 && value.y + value.height <= 1, "Visible bounds must fit inside the image");

const normalizedPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
}).strict();

export const artworkMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  delivery: z.object({ kind: z.literal("site-public"), path: z.string().startsWith("/") }).strict(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  visibleBounds: normalizedRectangleSchema,
  anchor: normalizedPointSchema,
  tags: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
  intendedPlacements: z.array(z.enum(["opening", "welcome", "details", "participants", "rsvp"])).min(1),
  animationCompatibility: z.array(z.enum(["static", "fade-rise", "curtain", "reveal", "seal-open"])).min(1),
  rights: z.object({
    artist: z.string().trim().min(1).max(160),
    classification: z.enum(["reusable", "exclusive"]),
    sourceFileCustodian: z.string().trim().min(1).max(160),
  }).strict(),
}).strict();

export type ArtworkMetadata = z.infer<typeof artworkMetadataSchema>;
