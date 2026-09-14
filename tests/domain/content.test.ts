import { describe, expect, it } from "vitest";
import { briefFromEvent, completeEventFromBrief, eventBriefDocumentSchema } from "@/lib/content/brief";
import { demoEvents } from "@/lib/demo-data";
import { saveDraftOverridesSchema } from "@/lib/studio/contracts";

describe("customer brief contracts", () => {
  it("round-trips each event type through a bounded editable brief", () => {
    for (const event of Object.values(demoEvents)) {
      const brief = briefFromEvent(event);
      expect(eventBriefDocumentSchema.parse(brief)).toEqual(brief);
      expect(completeEventFromBrief(brief)).toMatchObject({ ready: true, event: { type: event.type } });
    }
  });

  it("accepts incomplete saves and returns actionable submission issues", () => {
    const brief = briefFromEvent(demoEvents.wedding);
    brief.event.activities[0].venueName = "";
    const result = completeEventFromBrief(brief);
    expect(result.ready).toBe(false);
    if (!result.ready) expect(result.issues).toContainEqual(expect.objectContaining({ section: "schedule", path: "activities.0.venueName" }));
  });

  it("allows only the declared studio override surface", () => {
    const valid = { expectedRevision: 1, scenes: [{ id: "opening", asset: { id: "opening-frame", x: 50, y: 50, scale: 1, rotation: 0, zIndex: 0, hidden: false } }] };
    expect(saveDraftOverridesSchema.safeParse(valid).success).toBe(true);
    expect(saveDraftOverridesSchema.safeParse({ ...valid, arbitraryCss: "body{}" }).success).toBe(false);
    expect(saveDraftOverridesSchema.safeParse({ ...valid, scenes: [{ ...valid.scenes[0], asset: { ...valid.scenes[0].asset, assetKey: "other" } }] }).success).toBe(false);
  });
});
