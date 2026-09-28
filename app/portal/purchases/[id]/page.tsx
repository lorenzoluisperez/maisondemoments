import { PurchaseBriefWorkspace } from "@/components/portal/purchase-brief-workspace";

export default async function PurchaseBriefPage({ params }: { params: Promise<{ id: string }> }) {
  return <PurchaseBriefWorkspace id={(await params).id} />;
}
