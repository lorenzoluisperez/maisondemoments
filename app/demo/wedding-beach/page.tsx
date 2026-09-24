import type { Metadata } from "next";
import { BeachWeddingShowcase } from "@/components/demo/beach-wedding-showcase";
import { beachWeddingShowcase } from "@/lib/demo/beach-wedding-showcase";

export const metadata: Metadata = {
  title: "A sea of love · Maison de Moments",
  description: "A tropical wedding invitation showcase. Open the envelope to begin.",
  robots: { index: false, follow: false },
};

export default function BeachWeddingPage() {
  return <BeachWeddingShowcase fixture={beachWeddingShowcase} />;
}
