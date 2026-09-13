import Link from "next/link";
import type { ReactNode } from "react";
import { Gem, Palette, UserRound } from "lucide-react";

export function AppShell({ area, children }: { area: "portal" | "studio"; children: ReactNode }) {
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link href="/" className="workspace-brand"><span>MM</span><strong>Maison de Moments</strong></Link>
        <nav aria-label="Workspace">
          <Link className={area === "portal" ? "active" : ""} href="/portal"><UserRound /> Customer portal</Link>
          <Link className={area === "studio" ? "active" : ""} href="/studio"><Palette /> Production studio</Link>
          <Link href="/catalog"><Gem /> Invitation previews</Link>
        </nav>
        <p className="workspace-mode">Demo workspace<br /><span>Production data adapters are disabled</span></p>
      </aside>
      <div className="workspace-main">{children}</div>
    </div>
  );
}
