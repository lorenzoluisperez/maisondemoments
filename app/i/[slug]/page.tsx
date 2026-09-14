import { PrivateInvitation } from "@/components/invitation/private-invitation";
import { TheatricalInvitation } from "@/components/invitation/theatrical-invitation";
import { demoSnapshotsBySlug } from "@/lib/demo-data";

export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default async function InvitationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snapshot = demoSnapshotsBySlug[slug];
  return snapshot ? <TheatricalInvitation snapshot={snapshot} /> : <PrivateInvitation slug={slug} />;
}

export function generateStaticParams() {
  return Object.keys(demoSnapshotsBySlug).map((slug) => ({ slug }));
}
