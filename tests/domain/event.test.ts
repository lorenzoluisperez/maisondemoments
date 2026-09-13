import { describe, expect, it } from "vitest";
import { demoEvents } from "@/lib/demo-data";
import { eventSchema, validateEventForSubmission } from "@/lib/domain/event";

describe("event schemas", () => {
  it.each(["wedding", "birthday", "debut", "christening"] as const)("validates the %s fixture", (type) => {
    expect(eventSchema.parse(demoEvents[type]).type).toBe(type);
  });

  it("rejects an RSVP deadline after the event", () => {
    const event = { ...demoEvents.wedding, rsvpDeadline: "2026-09-21" };
    const result = validateEventForSubmission(event);
    expect(result.ready).toBe(false);
  });

  it("rejects insecure venue links and unknown fields", () => {
    const event = {
      ...demoEvents.birthday,
      activities: [{ ...demoEvents.birthday.activities[0], mapUrl: "javascript:alert(1)" }],
      injectedHtml: "<script>alert(1)</script>",
    };
    expect(eventSchema.safeParse(event).success).toBe(false);
  });
});
