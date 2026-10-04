import type { Metadata } from "next";
import { DebutPearlShowcase } from "@/components/demo/debut-pearl-showcase";
import { debutPearl } from "@/lib/demo/debut-pearl";

export const metadata: Metadata = {
  title: "Pearl & Poise · An Eighteenth Birthday Invitation",
  description: "An ivory and dusty-rose debut invitation, crafted with elegance by Maison de Moments. A fictional sample.",
  robots: { index: false, follow: false },
};

export default function DebutPearlPage() {
  return <DebutPearlShowcase fixture={debutPearl} />;
}
