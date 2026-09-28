"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

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
    setMessage(error ? error.message : "Enter the six-digit code we sent to your email.");
    if (!error) { setSent(true); setSeconds(60); }
    setSending(false);
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setSending(true); setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    if (error) { setMessage(error.message); setSending(false); return; }
    const profile = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: displayName.trim() || email.split("@")[0] }) });
    if (!profile.ok) { setMessage("Signed in, but we could not finish your account setup. Please try again."); setSending(false); return; }
    const body = await profile.json() as { account?: { type: "CUSTOMER" | "STAFF" } };
    const returnTo = safeReturnTo(new URLSearchParams(window.location.search).get("returnTo"));
    window.location.assign(body.account?.type === "STAFF" ? `/mfa?returnTo=${encodeURIComponent(returnTo)}` : returnTo);
  }

  return <main className="login-page"><section className="login-card"><Link href="/" className="workspace-brand"><span>MM</span><strong>Maison de Moments</strong></Link><div><p className="workspace-kicker">Private workspace</p><h1>Welcome</h1><p>Use your email to create an account or sign in. No password needed.</p></div><form onSubmit={submit}><label>Your name<input value={displayName} onChange={(change) => setDisplayName(change.target.value)} autoComplete="name" /></label><label>Email address<input type="email" required value={email} onChange={(change) => setEmail(change.target.value)} autoComplete="email" /></label><button className="workspace-button" disabled={sending || seconds > 0}><Mail />{sending ? "Sending…" : seconds > 0 ? `Resend in ${seconds}s` : "Send me a code"}</button></form>{sent ? <form onSubmit={(event) => void verify(event)}><label>Six-digit email code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label><button className="workspace-button" disabled={sending || code.length !== 6}>Verify and continue</button></form> : null}{message ? <p className="login-message" role="status">{message}</p> : null}<p className="login-security"><ShieldCheck />Staff complete an additional authenticator check.</p></section></main>;
}

function safeReturnTo(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/portal";
  try {
    const resolved = new URL(value, "https://app.local");
    return resolved.origin === "https://app.local" ? `${resolved.pathname}${resolved.search}${resolved.hash}` : "/portal";
  } catch { return "/portal"; }
}
