import { z } from "zod";

export const saveDraftOverridesSchema = z.object({
  expectedRevision: z.number().int().positive(),
  typography: z.enum(["romantic-serif", "editorial-serif"]).optional(),
  animationIntensity: z.enum(["subtle", "standard", "cinematic"]).optional(),
  scenes: z.array(z.object({
    id: z.string().min(1).max(80),
    layoutVariant: z.enum(["centered", "cards", "columns", "editorial"]).optional(),
    asset: z.object({
      id: z.string().min(1).max(80),
      x: z.number().min(-30).max(130),
      y: z.number().min(-30).max(130),
      scale: z.number().min(0.1).max(3),
      rotation: z.number().min(-180).max(180),
      zIndex: z.number().int().min(-10).max(20),
      hidden: z.boolean(),
    }).strict().optional(),
  }).strict()).max(8).optional(),
}).strict();

export type SaveDraftOverridesInput = z.input<typeof saveDraftOverridesSchema>;
