import { createHash } from "node:crypto";
import { eventDisplayNames, eventSchema, type Event } from "@/lib/domain/event";
import { invitationConfigSchema, invitationSnapshotSchema, snapshotMediaReferenceSchema, type InvitationConfig, type InvitationSnapshot } from "./config";
import { emptyWeddingDetails, weddingDetailsSchema, type WeddingDetails } from "@/lib/products/content";
import { weddingProduct, type WeddingProductSlug } from "@/lib/products/catalog";

export function compileInvitation(input: {
  event: Event;
  config: InvitationConfig;
  slug: string;
  version: number;
  media?: { gallery: Array<{ mediaId: string; alt: string }> };
  product?: { slug: WeddingProductSlug; weddingDetails?: WeddingDetails };
}): InvitationSnapshot & { contentHash: string } {
  const event = eventSchema.parse(input.event);
  const config = invitationConfigSchema.parse(input.config);
  const media = { gallery: snapshotMediaReferenceSchema.array().max(12).parse(input.media?.gallery ?? []) };
  const [title, secondaryName] = eventDisplayNames(event);
  const date = new Date(`${event.primaryLocalDate}T12:00:00Z`);
  const deadline = new Date(`${event.rsvpDeadline}T12:00:00Z`);
  const snapshot = invitationSnapshotSchema.parse({
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
      kind: activity.kind,
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
    media,
    product: input.product && event.type === "wedding" && weddingProduct(input.product.slug) ? {
      slug: input.product.slug,
      designVersion: weddingProduct(input.product.slug)!.designVersion,
      dateIso: event.activities.find((activity) => activity.kind === "ceremony")?.startsAt ?? event.activities[0].startsAt,
      timezone: event.timezone,
      weddingDetails: weddingDetailsSchema.parse(input.product.weddingDetails ?? emptyWeddingDetails),
    } : undefined,
    config,
  });
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
