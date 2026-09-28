import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaRequiredError, AuthenticationRequiredError, requireCurrentActor } from "@/lib/auth/current-actor";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  try {
    const actor = await requireCurrentActor();
    if (actor.accountType !== "STAFF") redirect("/portal");
  } catch (error) {
    if (error instanceof MfaRequiredError) redirect("/mfa?returnTo=/studio");
    if (error instanceof AuthenticationRequiredError) redirect("/login?returnTo=/studio");
    throw error;
  }
  return children;
}
