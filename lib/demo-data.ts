import type { Event } from "@/lib/domain/event";
import { compileInvitation } from "@/lib/invitation/compiler";
import { createPreset } from "@/lib/invitation/presets";

const common = { timezone: "Asia/Manila", rsvpDeadline: "2026-08-20", dressCode: "Formal attire in earth, blush, and wine tones." };

export const demoEvents: Record<Event["type"], Event> = {
  wedding: {
    ...common, id: "10000000-0000-4000-8000-000000000001", type: "wedding", primaryLocalDate: "2026-09-20", hostWording: "Together with their families",
    partners: [{ displayName: "Isabella", roleLabel: "Bride" }, { displayName: "Mateo", roleLabel: "Groom" }],
    activities: [
      { id: "20000000-0000-4000-8000-000000000001", kind: "ceremony", label: "Ceremony", startsAt: "2026-09-20T15:30:00+08:00", venueName: "Casa de Memoria", address: "Tagaytay, Cavite", mapUrl: "https://maps.google.com" },
      { id: "20000000-0000-4000-8000-000000000002", kind: "reception", label: "Dinner & dancing", startsAt: "2026-09-20T18:00:00+08:00", venueName: "The Glass Garden", address: "Tagaytay, Cavite", mapUrl: "https://maps.google.com" },
    ],
    participants: [{ roleLabel: "Parents of the bride", displayName: "Antonio & Celeste Reyes" }, { roleLabel: "Parents of the groom", displayName: "Rafael & Elena Santos" }, { roleLabel: "Matron of honor", displayName: "Sofia Villanueva" }, { roleLabel: "Best man", displayName: "Gabriel Mendoza" }],
    story: "A celebration of promises, laughter, and the beginning of forever.",
  },
  birthday: {
    ...common, id: "10000000-0000-4000-8000-000000000002", type: "birthday", primaryLocalDate: "2026-10-04",
    celebrant: { displayName: "Lucia", roleLabel: "Celebrant" }, displayedAge: 60,
    activities: [{ id: "20000000-0000-4000-8000-000000000003", kind: "party", label: "Dinner celebration", startsAt: "2026-10-04T18:00:00+08:00", venueName: "The Conservatory", address: "Makati City", mapUrl: "https://maps.google.com" }],
    participants: [], story: "Sixty beautiful years, and so many stories still to tell.",
  },
  debut: {
    ...common, id: "10000000-0000-4000-8000-000000000003", type: "debut", primaryLocalDate: "2026-11-08",
    debutante: { displayName: "Amara", roleLabel: "Debutante" },
    activities: [{ id: "20000000-0000-4000-8000-000000000004", kind: "program", label: "Debut program", startsAt: "2026-11-08T17:30:00+08:00", venueName: "Palacio de Memoria", address: "Parañaque City", mapUrl: "https://maps.google.com" }],
    participants: Array.from({ length: 18 }, (_, index) => ({ roleLabel: `Candle ${index + 1}`, displayName: `Loved One ${index + 1}` })),
    story: "A night of gratitude, dreams, and becoming.",
  },
  christening: {
    ...common, id: "10000000-0000-4000-8000-000000000004", type: "christening", primaryLocalDate: "2026-12-06",
    child: { displayName: "Elio", roleLabel: "Child" }, parentsOrGuardians: [{ displayName: "Nico & Mara Lim", roleLabel: "Parents" }],
    activities: [{ id: "20000000-0000-4000-8000-000000000005", kind: "ceremony", label: "Holy baptism", startsAt: "2026-12-06T10:00:00+08:00", venueName: "Santuario de San Antonio", address: "Forbes Park, Makati", mapUrl: "https://maps.google.com" }, { id: "20000000-0000-4000-8000-000000000006", kind: "reception", label: "Family luncheon", startsAt: "2026-12-06T12:00:00+08:00", venueName: "The Gallery", address: "BGC, Taguig", mapUrl: "https://maps.google.com" }],
    participants: [{ roleLabel: "Godmother", displayName: "Andrea Cruz" }, { roleLabel: "Godfather", displayName: "Miguel Tan" }],
    story: "Welcomed with faith, surrounded by love.",
  },
};

export const demoSnapshots = Object.fromEntries(Object.entries(demoEvents).map(([type, event]) => [type, compileInvitation({ event, config: createPreset(event.type, "midnight-garden"), slug: `${type}-midnight-garden-demo`, version: 1 })])) as Record<Event["type"], ReturnType<typeof compileInvitation>>;

export const demoSnapshotsBySlug = Object.fromEntries(
  (["wedding", "birthday", "debut", "christening"] as const).flatMap((eventType) =>
    (["midnight-garden", "luminous-parchment"] as const).map((collectionId) => {
      const slug = `${eventType}-${collectionId}-demo`;
      return [slug, compileInvitation({ event: demoEvents[eventType], config: createPreset(eventType, collectionId), slug, version: 1 })];
    }),
  ),
) as Record<string, ReturnType<typeof compileInvitation>>;
