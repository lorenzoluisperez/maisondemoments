import { ProductInvitation } from "@/components/products/product-invitation";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { getStudioOrder } from "@/lib/studio/service";
import { StudioPreviewPosition } from "@/components/studio/studio-preview-position";

export default async function StudioPreviewPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ editing?: string }> }) {
  const actor = await requireCurrentActor();
  const { orderId } = await params;
  const workspace = await getStudioOrder(actor, orderId);
  const editing = (await searchParams).editing === "1";
  return <><ProductInvitation snapshot={workspace.snapshot} editing={editing} />{editing && <StudioPreviewPosition orderId={orderId} />}</>;
}
