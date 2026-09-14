import Link from "next/link";
import type { ReactNode } from "react";
import { Gem, ListPlus, Palette, UserRound } from "lucide-react";
import { LogoutButton } from "@/components/workspace/logout-button";

export function AppShell({ area, children }: { area: "portal" | "studio"; children: ReactNode }) {
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link href="/" className="workspace-brand"><span>MM</span><strong>Maison de Moments</strong></Link>
        <nav aria-label="Workspace">
          <Link className={area === "portal" ? "active" : ""} href="/portal"><UserRound /> Customer portal</Link>
          <Link className={area === "studio" ? "active" : ""} href="/studio"><Palette /> Production studio</Link>
          <Link href="/studio/orders/new"><ListPlus /> New job order</Link>
          <Link href="/catalog"><Gem /> Invitation previews</Link>
        </nav>
        <div className="workspace-mode"><LogoutButton /><span>Private workspace<br />Changes are stored securely</span></div>
      </aside>
      <div className="workspace-main">{children}</div>
    </div>
  );
}
