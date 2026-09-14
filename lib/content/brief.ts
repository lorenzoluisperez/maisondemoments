import { z } from "zod";
import { eventSchema, validateEventForSubmission, type Event } from "@/lib/domain/event";
import { snapshotMediaReferenceSchema } from "@/lib/invitation/config";

const boundedText = (maximum: number) => z.string().trim().max(maximum);
const personDraftSchema = z.object({
  displayName: boundedText(120),
  roleLabel: boundedText(60),
}).strict();

const activityDraftSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["ceremony", "reception", "program", "party"]),
  label: boundedText(80),
  startsAt: boundedText(50),
  venueName: boundedText(160),
  address: boundedText(240),
  mapUrl: boundedText(2048),
}).strict();

const commonDraftShape = {
  id: z.string().uuid(),
  timezone: boundedText(80),
  primaryLocalDate: boundedText(10),
  rsvpDeadline: boundedText(10),
  hostWording: boundedText(260),
  activities: z.array(activityDraftSchema).max(8),
  participants: z.array(personDraftSchema).max(120),
  story: boundedText(2400),
  dressCode: boundedText(500),
  giftInformation: boundedText(800),
};

export const eventBriefEventSchema = z.discriminatedUnion("type", [
  z.object({ ...commonDraftShape, type: z.literal("wedding"), partners: z.tuple([personDraftSchema, personDraftSchema]) }).strict(),
  z.object({ ...commonDraftShape, type: z.literal("birthday"), celebrant: personDraftSchema, displayedAge: z.union([z.number().int().min(1).max(150), z.null()]) }).strict(),
  z.object({ ...commonDraftShape, type: z.literal("debut"), debutante: personDraftSchema }).strict(),
  z.object({ ...commonDraftShape, type: z.literal("christening"), child: personDraftSchema, parentsOrGuardians: z.array(personDraftSchema).max(4) }).strict(),
]);

export const eventBriefDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  event: eventBriefEventSchema,
  gallery: z.array(snapshotMediaReferenceSchema).max(12),
}).strict();

export type EventBriefDocument = z.infer<typeof eventBriefDocumentSchema>;

export const saveEventBriefSchema = z.object({
  expectedRevision: z.number().int().positive(),
  document: eventBriefDocumentSchema,
}).strict();

export function briefFromEvent(event: Event, gallery: EventBriefDocument["gallery"] = []): EventBriefDocument {
  const common = {
    id: event.id,
    type: event.type,
    timezone: event.timezone,
    primaryLocalDate: event.primaryLocalDate,
    rsvpDeadline: event.rsvpDeadline,
    hostWording: event.hostWording ?? "",
    activities: event.activities,
    participants: event.participants,
    story: event.story ?? "",
    dressCode: event.dressCode ?? "",
    giftInformation: event.giftInformation ?? "",
  };
  const eventDraft = (() => {
    switch (event.type) {
      case "wedding": return { ...common, partners: event.partners };
      case "birthday": return { ...common, celebrant: event.celebrant, displayedAge: event.displayedAge ?? null };
      case "debut": return { ...common, debutante: event.debutante };
      case "christening": return { ...common, child: event.child, parentsOrGuardians: event.parentsOrGuardians };
    }
  })();
  return eventBriefDocumentSchema.parse({ schemaVersion: 1, event: eventDraft, gallery });
}

export function completeEventFromBrief(document: EventBriefDocument) {
  const parsed = eventBriefDocumentSchema.parse(document);
  const candidate = stripEmptyOptionalText(parsed.event);
  const result = eventSchema.safeParse(candidate);
  if (!result.success) return { ready: false as const, issues: briefIssues(result.error) };
  const submission = validateEventForSubmission(result.data);
  if (!submission.ready) {
    return { ready: false as const, issues: submission.errors.formErrors.map((message) => ({ section: "schedule", path: "event", message })) };
  }
  return { ready: true as const, event: submission.event };
}

export function briefIssues(error: z.ZodError) {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return { section: sectionForPath(path), path, message: humanizeIssue(path, issue.message) };
  });
}

function stripEmptyOptionalText(event: EventBriefDocument["event"]) {
  const optionalKeys = ["hostWording", "story", "dressCode", "giftInformation"] as const;
  const candidate: Record<string, unknown> = { ...event };
  for (const key of optionalKeys) if (candidate[key] === "") delete candidate[key];
  if (candidate.type === "birthday" && candidate.displayedAge === null) delete candidate.displayedAge;
  return candidate;
}

function sectionForPath(path: string) {
  if (path.includes("activities") || path.includes("primaryLocalDate") || path.includes("rsvpDeadline") || path.includes("timezone")) return "schedule";
  if (path.includes("participants") || path.includes("parentsOrGuardians")) return "participants";
  if (path.includes("story") || path.includes("dressCode") || path.includes("giftInformation")) return "wording";
  return "identity";
}

function humanizeIssue(path: string, message: string) {
  const label = path.split(".").at(-1)?.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase()) ?? "Field";
  return `${label}: ${message}`;
}
