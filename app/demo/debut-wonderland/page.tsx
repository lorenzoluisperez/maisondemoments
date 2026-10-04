import type { Metadata } from "next";
import { DebutWonderlandShowcase } from "@/components/demo/debut-wonderland-showcase";
import { debutWonderland } from "@/lib/demo/debut-wonderland";

export const metadata: Metadata = {
  title: "Eighteen in Wonderland · A Storybook Birthday Invitation",
  description: "Turn the golden key and enter a watercolor tea garden. An original storybook eighteenth-birthday invitation by Maison de Moments. A fictional sample.",
  robots: { index: false, follow: false },
};

export default function DebutWonderlandPage() {
  return <DebutWonderlandShowcase fixture={debutWonderland} />;
}
