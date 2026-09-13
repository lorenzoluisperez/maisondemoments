import { z } from "zod";

function isIanaTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const namedPersonSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  roleLabel: z.string().trim().min(1).max(60),
}).strict();

const activitySchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["ceremony", "reception", "program", "party"]),
  label: z.string().trim().min(1).max(80),
  startsAt: z.string().datetime({ offset: true }),
  venueName: z.string().trim().min(1).max(160),
  address: z.string().trim().min(1).max(240),
  mapUrl: z.string().url().refine((value) => ["https:"].includes(new URL(value).protocol), "Map URL must use HTTPS"),
}).strict();

const baseEventSchema = z.object({
  id: z.string().uuid(),
  timezone: z.string().min(1).max(80).refine(isIanaTimeZone, "Timezone must be a valid IANA timezone"),
  primaryLocalDate: z.string().date(),
  rsvpDeadline: z.string().date(),
  hostWording: z.string().trim().max(260).optional(),
  activities: z.array(activitySchema).min(1).max(8),
  participants: z.array(namedPersonSchema).max(120).default([]),
  story: z.string().trim().max(2400).optional(),
  dressCode: z.string().trim().max(500).optional(),
  giftInformation: z.string().trim().max(800).optional(),
}).strict();

export const weddingEventSchema = baseEventSchema.extend({
  type: z.literal("wedding"),
  partners: z.tuple([namedPersonSchema, namedPersonSchema]),
}).strict();

export const birthdayEventSchema = baseEventSchema.extend({
  type: z.literal("birthday"),
  celebrant: namedPersonSchema,
  displayedAge: z.number().int().min(1).max(150).optional(),
}).strict();

export const debutEventSchema = baseEventSchema.extend({
  type: z.literal("debut"),
  debutante: namedPersonSchema,
}).strict();

export const christeningEventSchema = baseEventSchema.extend({
  type: z.literal("christening"),
  child: namedPersonSchema,
  parentsOrGuardians: z.array(namedPersonSchema).min(1).max(4),
}).strict();

export const eventSchema = z.discriminatedUnion("type", [weddingEventSchema, birthdayEventSchema, debutEventSchema, christeningEventSchema]);
export type Event = z.infer<typeof eventSchema>;
export type EventType = Event["type"];

export function eventDisplayNames(event: Event): [string, string?] {
  switch (event.type) {
    case "wedding": return [event.partners[0].displayName, event.partners[1].displayName];
    case "birthday": return [event.celebrant.displayName];
    case "debut": return [event.debutante.displayName];
    case "christening": return [event.child.displayName];
  }
}

export function validateEventForSubmission(event: Event) {
  const result = eventSchema.safeParse(event);
  if (!result.success) return { ready: false as const, errors: result.error.flatten() };
  if (event.rsvpDeadline > event.primaryLocalDate) {
    return { ready: false as const, errors: { formErrors: ["RSVP deadline must be on or before the event date"], fieldErrors: {} } };
  }
  return { ready: true as const, event: result.data };
}
