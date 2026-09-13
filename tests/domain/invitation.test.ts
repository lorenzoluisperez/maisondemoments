import { describe, expect, it } from "vitest";
import { demoEvents, demoSnapshotsBySlug } from "@/lib/demo-data";
import { compileInvitation } from "@/lib/invitation/compiler";
import { createPreset, eventPresets } from "@/lib/invitation/presets";
import { getCatalogArtwork } from "@/lib/media/catalog";

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

  it("includes stable media references in the immutable content hash", () => {
    const base = { event: demoEvents.birthday, config: createPreset("birthday", "luminous-parchment"), slug: "birthday-demo", version: 1 };
    const withoutMedia = compileInvitation(base);
    const withMedia = compileInvitation({
      ...base,
      media: { gallery: [{ mediaId: "00000000-0000-4000-8000-000000000001", alt: "A birthday portrait" }] },
    });
    expect(withMedia.media.gallery).toHaveLength(1);
    expect(withMedia.contentHash).not.toBe(withoutMedia.contentHash);
  });

  it("binds every event and collection preset to released artwork", () => {
    expect(eventPresets).toHaveLength(8);
    eventPresets.forEach((preset) => {
      preset.config.scenes.forEach((scene) => {
        expect(scene.assets).toHaveLength(1);
        expect(getCatalogArtwork(scene.assets[0].assetKey)).not.toBeNull();
      });
    });
  });
});
