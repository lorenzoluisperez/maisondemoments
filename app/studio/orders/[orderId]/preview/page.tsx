import { TheatricalInvitation } from "@/components/invitation/theatrical-invitation";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { getStudioOrder } from "@/lib/studio/service";

export default async function StudioPreviewPage({ params }: { params: Promise<{ orderId: string }> }) {
  const actor = await requireCurrentActor();
  const { orderId } = await params;
  const workspace = await getStudioOrder(actor, orderId);
  return <TheatricalInvitation snapshot={workspace.snapshot} />;
}
