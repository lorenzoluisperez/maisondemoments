"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setMessage(null);
    const returnTo = safeReturnTo(new URLSearchParams(window.location.search).get("returnTo"));
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
        data: { display_name: displayName.trim() || email.split("@")[0] },
      },
    });
    setMessage(error ? error.message : "Check your email for the secure sign-in link.");
    setSending(false);
  }

  return <main className="login-page"><section className="login-card"><Link href="/" className="workspace-brand"><span>MM</span><strong>Maison de Moments</strong></Link><div><p className="workspace-kicker">Private workspace</p><h1>Welcome back</h1><p>Use the email address connected to your invitation order or staff account.</p></div><form onSubmit={submit}><label>Your name<input value={displayName} onChange={(change) => setDisplayName(change.target.value)} autoComplete="name" /></label><label>Email address<input type="email" required value={email} onChange={(change) => setEmail(change.target.value)} autoComplete="email" /></label><button className="workspace-button" disabled={sending}><Mail />{sending ? "Sending…" : "Email me a sign-in link"}</button></form>{message ? <p className="login-message">{message}</p> : null}<p className="login-security"><ShieldCheck />The link signs you into your private customer or staff workspace.</p></section></main>;
}

function safeReturnTo(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/portal";
  try {
    const resolved = new URL(value, "https://app.local");
    return resolved.origin === "https://app.local" ? `${resolved.pathname}${resolved.search}${resolved.hash}` : "/portal";
  } catch { return "/portal"; }
}
