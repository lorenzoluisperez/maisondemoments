import { describe, expect, it } from "vitest";
import { compileInvitation } from "@/lib/invitation/compiler";
import { createPreset } from "@/lib/invitation/presets";
import { demoEvents } from "@/lib/demo-data";
import { createReviewVersionSchema, requestChangesSchema } from "@/lib/reviews/contracts";
import { describeMaterialChanges } from "@/lib/reviews/material-changes";

describe("review and publication contracts", () => {
  it("requires every internal QA acknowledgement before review creation", () => {
    const valid = { expectedRevision: 2, checklist: { contentVerified: true, responsiveChecked: true, accessibilityChecked: true, mediaChecked: true } };
    expect(createReviewVersionSchema.safeParse(valid).success).toBe(true);
    expect(createReviewVersionSchema.safeParse({ ...valid, checklist: { ...valid.checklist, mediaChecked: false } }).success).toBe(false);
  });

  it("requires bounded consolidated feedback items", () => {
    expect(requestChangesSchema.safeParse({ summary: "Please adjust the welcome", items: [{ sectionKey: "welcome", message: "Move the floral frame away from the name." }] }).success).toBe(true);
    expect(requestChangesSchema.safeParse({ summary: "Please adjust", items: [] }).success).toBe(false);
    expect(requestChangesSchema.safeParse({ summary: "Please adjust", items: [{ sectionKey: "script", message: "alert(1)" }] }).success).toBe(false);
  });

  it("identifies material event and design changes between immutable snapshots", () => {
    const base = compileInvitation({ event: demoEvents.wedding, config: createPreset("wedding", "midnight-garden"), slug: "review-test", version: 1 });
    const nextEvent = { ...demoEvents.wedding, activities: demoEvents.wedding.activities.map((activity, index) => index ? activity : { ...activity, venueName: "A new chapel" }) };
    const nextConfig = { ...createPreset("wedding", "midnight-garden"), typography: "editorial-serif" as const };
    const next = compileInvitation({ event: nextEvent, config: nextConfig, slug: "review-test", version: 2 });
    expect(describeMaterialChanges(next, base)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "schedule" }), expect.objectContaining({ kind: "design" }),
    ]));
  });
});
