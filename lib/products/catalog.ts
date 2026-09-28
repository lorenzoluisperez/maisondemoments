import { weddingContentLimits } from "@/lib/products/content";

const weddingCapabilities = {
  sections: ["story", "program", "entourage", "photos"],
  limits: weddingContentLimits,
  essentialOptions: ["fit"],
  signatureOptions: ["fit", "palette", "ornaments"],
} as const;

export const weddingProducts = [
  {
    slug: "garden-romance", name: "Garden Romance", number: "01",
    designVersion: 1, capabilities: weddingCapabilities,
    setting: "A garden celebration in soft watercolor",
    description: "An intimate invitation framed by painted botanicals, paper keepsakes, and a sealed opening.",
    image: "/wedding-showcase/tagaytay-invitation-desktop-v1.webp", preview: "/demo/wedding",
    artworkNote: "The garden scenery is illustrative and stays part of this design.",
  },
  {
    slug: "coastal-romance", name: "Coastal Romance", number: "02",
    designVersion: 1, capabilities: weddingCapabilities,
    setting: "A sunlit celebration by the sea",
    description: "A blue envelope opens onto painted surf, tropical flowers, and a relaxed seaside story.",
    image: "/beach-wedding/shoreline-watercolor.webp", preview: "/demo/wedding-beach",
    artworkNote: "The coastal scenery is illustrative and stays part of this design.",
  },
  {
    slug: "heritage-romance", name: "Heritage Romance", number: "03",
    designVersion: 1, capabilities: weddingCapabilities,
    setting: "A celebration inspired by Filipino heritage",
    description: "Engraved details, a pearl-sealed envelope, and architectural illustrations bring this formal story to life.",
    image: "/bridgerton-wedding/courtyard-desktop.webp", preview: "/demo/wedding-bridgerton",
    artworkNote: "The heritage scenery is illustrative and stays part of this design.",
  },
] as const;

export type WeddingProductSlug = (typeof weddingProducts)[number]["slug"];
export type ProductTier = "ESSENTIAL" | "SIGNATURE" | "COUTURE";

export function weddingProduct(slug: string) {
  return weddingProducts.find((product) => product.slug === slug);
}

export const standardTerms = {
  revisionRounds: 2,
  galleryPhotos: weddingContentLimits.photos,
  households: 500,
  hostingDaysAfterEvent: 90,
} as const;
