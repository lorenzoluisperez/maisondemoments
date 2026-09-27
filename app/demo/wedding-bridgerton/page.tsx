import type { Metadata } from "next";
import { BridgertonWeddingShowcase } from "@/components/demo/bridgerton-wedding-showcase";
import { bridgertonWeddingShowcase } from "@/lib/demo/bridgerton-wedding-showcase";

export const metadata: Metadata = {
  title: "A Season of Forever · Maison de Moments",
  description: "A Filipino heritage wedding invitation study. Open the envelope to begin.",
  robots: { index: false, follow: false },
};

export default function BridgertonWeddingPage() {
  return <BridgertonWeddingShowcase fixture={bridgertonWeddingShowcase} />;
}
