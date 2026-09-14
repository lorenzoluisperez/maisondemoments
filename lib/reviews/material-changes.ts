import type { InvitationSnapshot } from "@/lib/invitation/config";
import type { MaterialChange } from "@/lib/reviews/contracts";

export function describeMaterialChanges(current: InvitationSnapshot, previous?: InvitationSnapshot): MaterialChange[] {
  if (!previous) return [{ kind: "initial", label: "Initial invitation review" }];
  const changes: MaterialChange[] = [];
  if (current.title !== previous.title || current.secondaryName !== previous.secondaryName || current.hostWording !== previous.hostWording) {
    changes.push({ kind: "identity", label: "Names or host wording changed" });
  }
  if (current.dateLabel !== previous.dateLabel) changes.push({ kind: "date", label: "Event date changed" });
  if (current.rsvpDeadlineLabel !== previous.rsvpDeadlineLabel) changes.push({ kind: "deadline", label: "RSVP deadline changed" });
  if (!same(current.activities.map(({ venueName, address, mapUrl }) => ({ venueName, address, mapUrl })), previous.activities.map(({ venueName, address, mapUrl }) => ({ venueName, address, mapUrl })))) {
    changes.push({ kind: "schedule", label: "Venue or directions changed" });
  } else if (!same(current.activities, previous.activities)) {
    changes.push({ kind: "schedule", label: "Event schedule changed" });
  }
  if (!same(current.participants, previous.participants)) changes.push({ kind: "participants", label: "Participant list changed" });
  if (current.story !== previous.story || current.dressCode !== previous.dressCode || current.giftInformation !== previous.giftInformation) {
    changes.push({ kind: "content", label: "Invitation wording or event guidance changed" });
  }
  if (!same(current.media.gallery, previous.media.gallery)) changes.push({ kind: "media", label: "Invitation photographs changed" });
  if (!same(current.config, previous.config)) changes.push({ kind: "design", label: "Design composition changed" });
  return changes.length ? changes : [{ kind: "design", label: "A new renderer snapshot was created" }];
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}
