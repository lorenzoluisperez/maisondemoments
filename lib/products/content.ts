import { z } from "zod";

const text = (length: number) => z.string().trim().max(length);

export const weddingContentLimits = { storyChapters: 3, entourageGroups: 10, entourageMembers: 40, programMoments: 20, photos: 12 } as const;

export const weddingDetailsSchema = z.object({
  preferredNames: z.tuple([text(120), text(120)]).default(["", ""]),
  monogram: text(20).default(""),
  storyChapters: z.array(z.object({ title: text(120), copy: text(600) }).strict()).max(weddingContentLimits.storyChapters).default([]),
  entourage: z.array(z.object({ id: z.string().uuid(), title: text(100), members: z.array(text(120)).max(weddingContentLimits.entourageMembers) }).strict()).max(weddingContentLimits.entourageGroups).default([]),
  program: z.array(z.object({ id: z.string().uuid(), time: text(40), title: text(120), detail: text(240) }).strict()).max(weddingContentLimits.programMoments).default([]),
}).strict();

export type WeddingDetails = z.infer<typeof weddingDetailsSchema>;
export const emptyWeddingDetails: WeddingDetails = { preferredNames: ["", ""], monogram: "", storyChapters: [], entourage: [], program: [] };
