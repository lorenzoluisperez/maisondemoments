"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Activity, Gem, ListPlus, Palette, UserRound } from "lucide-react";
import { LogoutButton } from "@/components/workspace/logout-button";

export function AppShell({ area, children }: { area: "portal" | "studio"; children: ReactNode }) {
  const [actor, setActor] = useState<{ accountType: "CUSTOMER" | "STAFF"; roles: string[] } | null>(null);
  useEffect(() => { void fetch("/api/account", { cache: "no-store", credentials: "same-origin" }).then(async (response) => {
    if (response.ok) setActor((await response.json() as { actor: typeof actor }).actor);
  }); }, []);
  const staff = actor?.accountType === "STAFF";
  const admin = staff && actor.roles.includes("ADMIN");
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link href="/" className="workspace-brand"><span>MM</span><strong>Maison de Moments</strong></Link>
        <nav aria-label="Workspace">
          <Link className={area === "portal" ? "active" : ""} href="/portal"><UserRound /> Customer portal</Link>
          {staff ? <Link className={area === "studio" ? "active" : ""} href="/studio"><Palette /> Production studio</Link> : null}
          {admin ? <Link href="/studio/orders/new"><ListPlus /> New job order</Link> : null}
          {admin ? <Link href="/studio/operations"><Activity /> Operations</Link> : null}
          <Link href="/catalog"><Gem /> Invitation previews</Link>
        </nav>
        <div className="workspace-mode"><LogoutButton /><span>Private workspace<br />Changes are stored securely</span></div>
      </aside>
      <div className="workspace-main">{children}</div>
    </div>
  );
}
