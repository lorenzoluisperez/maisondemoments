import { ReviewWorkspace } from "@/components/review/review-workspace";

export default async function ReviewPage({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  return <ReviewWorkspace versionId={versionId} />;
}
