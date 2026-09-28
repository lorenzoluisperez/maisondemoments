import { StudioWorkspace } from "@/components/studio/studio-workspace";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  return <StudioWorkspace initialOrderId={(await searchParams).order} />;
}
