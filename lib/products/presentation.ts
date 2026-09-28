import { z } from "zod";
import type { CSSProperties } from "react";
import type { WeddingProductSlug } from "@/lib/products/catalog";

export const productPresentationSchema = z.object({
  palette: z.enum(["original", "soft", "deep"]),
  ornaments: z.enum(["original", "quiet"]),
  fit: z.enum(["standard", "compact"]).default("standard"),
}).strict();
export type ProductPresentation = z.infer<typeof productPresentationSchema>;
export const originalProductPresentation: ProductPresentation = { palette: "original", ornaments: "original", fit: "standard" };

const accents: Record<WeddingProductSlug, Record<Exclude<ProductPresentation["palette"], "original">, Record<string, string>>> = {
  "garden-romance": {
    soft: { "--olive": "#5d6555", "--olive-light": "#7b8571", "--bronze": "#ac796d", "--rose": "#9c6a70" },
    deep: { "--olive": "#263f38", "--olive-light": "#48655b", "--bronze": "#a7794d", "--rose": "#8a585c" },
  },
  "coastal-romance": {
    soft: { "--deep": "#486b74", "--ink": "#526f78", "--sea": "#73a8ad", "--coral": "#b77f78" },
    deep: { "--deep": "#193f55", "--ink": "#27465a", "--sea": "#34758c", "--coral": "#bd6f60" },
  },
  "heritage-romance": {
    soft: { "--ink": "#615461", "--wine": "#8b6875", "--blue": "#8da3af", "--gold": "#b29669" },
    deep: { "--ink": "#403844", "--wine": "#593c52", "--blue": "#5e788e", "--gold": "#9f7846" },
  },
};

export function productAccentStyle(slug: WeddingProductSlug, presentation: ProductPresentation): CSSProperties {
  return presentation.palette === "original" ? {} : accents[slug][presentation.palette] as CSSProperties;
}
