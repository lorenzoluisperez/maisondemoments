import { describe, expect, it } from "vitest";
import { demoEvents, demoSnapshotsBySlug } from "@/lib/demo-data";
import { compileInvitation } from "@/lib/invitation/compiler";
import { createPreset } from "@/lib/invitation/presets";

describe("invitation compiler", () => {
  it("produces a deterministic snapshot and hash", () => {
    const input = { event: demoEvents.wedding, config: createPreset("wedding", "midnight-garden"), slug: "wedding-demo", version: 1 };
    expect(compileInvitation(input)).toEqual(compileInvitation(input));
    expect(compileInvitation(input).contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes the hash when a material fact changes", () => {
    const config = createPreset("birthday", "luminous-parchment");
    const original = compileInvitation({ event: demoEvents.birthday, config, slug: "birthday-demo", version: 1 });
    const changed = compileInvitation({ event: { ...demoEvents.birthday, primaryLocalDate: "2026-10-05" }, config, slug: "birthday-demo", version: 1 });
    expect(changed.contentHash).not.toBe(original.contentHash);
  });

  it("compiles every launch preset as a distinct immutable snapshot", () => {
    const snapshots = Object.values(demoSnapshotsBySlug);

    expect(snapshots).toHaveLength(8);
    expect(new Set(snapshots.map((snapshot) => snapshot.contentHash)).size).toBe(8);
    expect(snapshots.every((snapshot) => snapshot.contentHash.match(/^[a-f0-9]{64}$/))).toBe(true);
  });

  it("preserves all 18 debut participants for natural page flow", () => {
    const debut = demoSnapshotsBySlug["debut-midnight-garden-demo"];

    expect(debut.participants).toHaveLength(18);
    expect(debut.participants.at(-1)).toEqual({ roleLabel: "Candle 18", displayName: "Loved One 18" });
  });
});
