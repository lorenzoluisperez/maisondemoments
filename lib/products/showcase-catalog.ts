import debutPreview from "@/public/debut-pearl/invitation-preview-v3.webp";
import wonderlandPreview from "@/public/debut-wonderland/invitation-preview-v2.webp";
import { weddingProducts } from "./catalog";

// Public discovery is independent of the dormant wedding commerce capabilities.
export const showcaseDesigns = [
  ...weddingProducts.map((product) => ({ ...product, category: "wedding" as const, categoryLabel: "Wedding", imageTreatment: "cover" as const })),
  {
    slug: "pearl-and-poise", name: "Pearl & Poise", number: "04",
    category: "debut" as const, categoryLabel: "Debut",
    setting: "Eighteen, beautifully celebrated",
    description: "A pearl-sealed envelope, delicate florals, and ivory keepsake cards for a beautiful new chapter.",
    image: debutPreview, imageTreatment: "stationery" as const, preview: "/demo/debut-pearl",
    artworkNote: "The floral stationery and pearl details are original elements of this design.",
  },
  {
    slug: "eighteen-in-wonderland", name: "Eighteen in Wonderland", number: "05",
    category: "debut" as const, categoryLabel: "Debut",
    setting: "A little wonder. A beautiful new chapter.",
    description: "Turn a golden key into a watercolor tea garden, with tactile paper and illustrated storybook chapters for eighteen.",
    image: wonderlandPreview, imageTreatment: "stationery" as const, preview: "/demo/debut-wonderland",
    artworkNote: "The Wonderland characters, painted garden, and keepsake illustrations are original elements of this design.",
  },
];

export function showcaseDesign(slug: string) {
  return showcaseDesigns.find((design) => design.slug === slug);
}

export const showcaseCategories = [
  { id: "wedding", label: "Weddings", description: "Three beautiful ways to begin forever." },
  { id: "debut", label: "Debuts / 18th Birthdays", description: "A new chapter, a little wonder, and the people who made it beautiful." },
] as const;
