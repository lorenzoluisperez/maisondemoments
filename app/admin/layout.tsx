import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthenticationRequiredError, MfaRequiredError, requireCurrentActor } from "@/lib/auth/current-actor";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    const actor = await requireCurrentActor();
    if (actor.accountType !== "STAFF" || !actor.roles.includes("ADMIN")) redirect("/studio");
  } catch (error) {
    if (error instanceof MfaRequiredError) redirect("/mfa?returnTo=/admin");
    if (error instanceof AuthenticationRequiredError) redirect("/login?returnTo=/admin");
    throw error;
  }
  return children;
}
