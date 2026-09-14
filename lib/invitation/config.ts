import { z } from "zod";

export const moduleTypeSchema = z.enum(["opening", "identity", "details", "participants", "story", "gallery", "dress-code", "gifts", "rsvp", "closing"]);

export const assetPlacementSchema = z.object({
  id: z.string().min(1),
  assetKey: z.string().min(1),
  anchor: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"]),
  x: z.number().min(-30).max(130),
  y: z.number().min(-30).max(130),
  scale: z.number().min(0.1).max(3),
  rotation: z.number().min(-180).max(180),
  zIndex: z.number().int().min(-10).max(20),
  hidden: z.boolean().default(false),
}).strict();

export const sceneSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  modules: z.array(moduleTypeSchema).min(1).max(6),
  layoutVariant: z.enum(["centered", "cards", "columns", "editorial"]),
  interactionPreset: z.enum(["seal-open", "fade-rise", "curtain", "reveal", "static"]),
  assets: z.array(assetPlacementSchema).max(12),
}).strict();

export const invitationConfigSchema = z.object({
  schemaVersion: z.literal(1),
  themeVersion: z.string().min(1),
  rendererVersion: z.literal("v1"),
  typography: z.enum(["romantic-serif", "editorial-serif"]),
  animationIntensity: z.enum(["subtle", "standard", "cinematic"]),
  scenes: z.array(sceneSchema).min(4).max(8),
}).strict();

export type InvitationConfig = z.infer<typeof invitationConfigSchema>;

export const snapshotMediaReferenceSchema = z.object({
  mediaId: z.string().uuid(),
  alt: z.string().trim().max(300),
}).strict();

export const invitationSnapshotSchema = z.object({
  version: z.number().int().positive(),
  slug: z.string().min(1).max(200),
  eventType: z.enum(["wedding", "birthday", "debut", "christening"]),
  title: z.string().min(1).max(120),
  secondaryName: z.string().min(1).max(120).optional(),
  hostWording: z.string().min(1).max(260),
  dateLabel: z.string().min(1).max(120),
  rsvpDeadlineLabel: z.string().min(1).max(120),
  activities: z.array(z.object({
    id: z.string().uuid(), label: z.string().min(1).max(80), timeLabel: z.string().min(1).max(80),
    venueName: z.string().min(1).max(160), address: z.string().min(1).max(240), mapUrl: z.string().url(),
  }).strict()).min(1).max(8),
  participants: z.array(z.object({ roleLabel: z.string().min(1).max(60), displayName: z.string().min(1).max(120) }).strict()).max(120),
  story: z.string().max(2400).optional(),
  dressCode: z.string().max(500).optional(),
  giftInformation: z.string().max(800).optional(),
  media: z.object({ gallery: z.array(snapshotMediaReferenceSchema).max(12) }).strict(),
  config: invitationConfigSchema,
}).strict();

export type InvitationSnapshot = z.infer<typeof invitationSnapshotSchema>;
