import type { EventType } from "@/lib/domain/event";
import type { InvitationConfig } from "./config";

export const artworkCollections = [
  { id: "midnight-garden", name: "Midnight Garden", themeVersion: "midnight-garden@1.0.0" },
  { id: "luminous-parchment", name: "Luminous Parchment", themeVersion: "luminous-parchment@1.0.0" },
] as const;

const participantEvents: EventType[] = ["wedding", "debut", "christening"];

export function createPreset(eventType: EventType, collectionId: (typeof artworkCollections)[number]["id"]): InvitationConfig {
  const collection = artworkCollections.find((item) => item.id === collectionId) ?? artworkCollections[0];
  const participantScenes: InvitationConfig["scenes"] = participantEvents.includes(eventType)
    ? [{ id: "participants", label: "People", modules: ["participants"], layoutVariant: "columns", interactionPreset: "reveal", assets: [] }]
    : [];
  return {
    schemaVersion: 1,
    themeVersion: collection.themeVersion,
    rendererVersion: "v1",
    typography: collectionId === "midnight-garden" ? "romantic-serif" : "editorial-serif",
    animationIntensity: "cinematic",
    scenes: [
      { id: "opening", label: "Opening", modules: ["opening"], layoutVariant: "centered", interactionPreset: "seal-open", assets: [] },
      { id: "welcome", label: "Welcome", modules: ["identity"], layoutVariant: "centered", interactionPreset: "curtain", assets: [] },
      { id: "details", label: "Details", modules: ["details", "dress-code"], layoutVariant: "cards", interactionPreset: "fade-rise", assets: [] },
      ...participantScenes,
      { id: "rsvp", label: "RSVP", modules: ["rsvp", "closing"], layoutVariant: "centered", interactionPreset: "fade-rise", assets: [] },
    ],
  };
}

export const eventPresets = (["wedding", "birthday", "debut", "christening"] as const).flatMap((eventType) => artworkCollections.map((collection) => ({
  id: `${eventType}-${collection.id}`,
  eventType,
  collectionId: collection.id,
  config: createPreset(eventType, collection.id),
})));
