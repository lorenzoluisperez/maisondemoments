import type { ArtworkMetadata } from "@/lib/media/catalog-schema";

export const catalogArtworkAssets = {
  "midnight-garden.botanical-frame": {
    collectionKey: "midnight-garden",
    assetKey: "botanical-frame",
    name: "Midnight Garden botanical frame",
    metadata: {
      schemaVersion: 1,
      delivery: { kind: "site-public", path: "/maison-botanical.webp" },
      width: 768,
      height: 1152,
      visibleBounds: { x: 0, y: 0, width: 1, height: 1 },
      anchor: { x: 0.5, y: 0.5 },
      tags: ["botanical", "floral", "dark", "frame"],
      intendedPlacements: ["opening", "welcome", "details", "participants", "rsvp"],
      animationCompatibility: ["static", "fade-rise", "curtain", "reveal", "seal-open"],
      rights: { artist: "Maison de Moments", classification: "reusable", sourceFileCustodian: "Maison de Moments" },
    } satisfies ArtworkMetadata,
  },
  "luminous-parchment.parchment-frame": {
    collectionKey: "luminous-parchment",
    assetKey: "parchment-frame",
    name: "Luminous Parchment frame",
    metadata: {
      schemaVersion: 1,
      delivery: { kind: "site-public", path: "/maison-luminous-parchment.webp" },
      width: 768,
      height: 1152,
      visibleBounds: { x: 0, y: 0, width: 1, height: 1 },
      anchor: { x: 0.5, y: 0.5 },
      tags: ["parchment", "luminous", "warm", "frame"],
      intendedPlacements: ["opening", "welcome", "details", "participants", "rsvp"],
      animationCompatibility: ["static", "fade-rise", "curtain", "reveal", "seal-open"],
      rights: { artist: "Maison de Moments", classification: "reusable", sourceFileCustodian: "Maison de Moments" },
    } satisfies ArtworkMetadata,
  },
} as const;

export type CatalogArtworkKey = keyof typeof catalogArtworkAssets;

export function getCatalogArtwork(assetKey: string) {
  return catalogArtworkAssets[assetKey as CatalogArtworkKey] ?? null;
}

export function catalogAssetKeyForCollection(collectionKey: "midnight-garden" | "luminous-parchment"): CatalogArtworkKey {
  return collectionKey === "midnight-garden"
    ? "midnight-garden.botanical-frame"
    : "luminous-parchment.parchment-frame";
}
