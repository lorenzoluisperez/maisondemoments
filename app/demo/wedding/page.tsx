import type { Metadata } from "next";
import { WeddingShowcase } from "@/components/demo/wedding-showcase";
import { weddingShowcase } from "@/lib/demo/wedding-showcase";

export const metadata: Metadata = {
  title: "A letter for you · Maison de Moments",
  description: "Something special is waiting inside. Tap the seal to open.",
  robots: { index: false, follow: false },
};

export default function WeddingDemoPage() {
  return <WeddingShowcase fixture={weddingShowcase} />;
}
