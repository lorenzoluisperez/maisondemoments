import { ProductInvitation } from "@/components/products/product-invitation";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { getReviewVersion } from "@/lib/reviews/service";

export default async function ReviewPreviewPage({ params }: { params: Promise<{ versionId: string }> }) {
  const actor = await requireCurrentActor();
  const { versionId } = await params;
  const review = await getReviewVersion(actor, versionId);
  return <ProductInvitation snapshot={review.snapshot} />;
}
