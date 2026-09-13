import { createHash } from "node:crypto";
import { eventDisplayNames, eventSchema, type Event } from "@/lib/domain/event";
import { invitationConfigSchema, type InvitationConfig, type InvitationSnapshot } from "./config";

export function compileInvitation(input: { event: Event; config: InvitationConfig; slug: string; version: number }): InvitationSnapshot & { contentHash: string } {
  const event = eventSchema.parse(input.event);
  const config = invitationConfigSchema.parse(input.config);
  const [title, secondaryName] = eventDisplayNames(event);
  const date = new Date(`${event.primaryLocalDate}T12:00:00Z`);
  const deadline = new Date(`${event.rsvpDeadline}T12:00:00Z`);
  const snapshot: InvitationSnapshot = {
    version: input.version,
    slug: input.slug,
    eventType: event.type,
    title,
    secondaryName,
    hostWording: event.hostWording ?? defaultHostWording(event.type),
    dateLabel: new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(date),
    rsvpDeadlineLabel: new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(deadline),
    activities: event.activities.map((activity) => ({
      id: activity.id,
      label: activity.label,
      timeLabel: new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: event.timezone }).format(new Date(activity.startsAt)),
      venueName: activity.venueName,
      address: activity.address,
      mapUrl: activity.mapUrl,
    })),
    participants: event.participants,
    story: event.story,
    dressCode: event.dressCode,
    giftInformation: event.giftInformation,
    config,
  };
  const contentHash = createHash("sha256").update(stableStringify(snapshot)).digest("hex");
  return { ...snapshot, contentHash };
}

function defaultHostWording(type: Event["type"]) {
  if (type === "wedding") return "Together with their families";
  if (type === "christening") return "Together with their loving family";
  return "You are warmly invited to celebrate";
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
