"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const [working, setWorking] = useState(false);
  return <button className="workspace-logout" disabled={working} onClick={() => void (async () => {
    setWorking(true);
    await createClient().auth.signOut();
    window.location.assign("/login");
  })()}><LogOut />{working ? "Signing out…" : "Sign out"}</button>;
}
