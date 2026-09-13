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

export interface InvitationSnapshot {
  version: number;
  slug: string;
  eventType: "wedding" | "birthday" | "debut" | "christening";
  title: string;
  secondaryName?: string;
  hostWording: string;
  dateLabel: string;
  rsvpDeadlineLabel: string;
  activities: Array<{ id: string; label: string; timeLabel: string; venueName: string; address: string; mapUrl: string }>;
  participants: Array<{ roleLabel: string; displayName: string }>;
  story?: string;
  dressCode?: string;
  giftInformation?: string;
  media: { gallery: Array<z.infer<typeof snapshotMediaReferenceSchema>> };
  config: InvitationConfig;
}
