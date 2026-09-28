"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; qr: string; secret: string };

export function StaffMfa() {
  const [factor, setFactor] = useState<Factor | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const auth = createClient().auth;
    void auth.mfa.getAuthenticatorAssuranceLevel().then(async ({ data }) => {
      if (data?.currentLevel === "aal2") { window.location.assign(safeReturnTo()); return; }
      const listed = await auth.mfa.listFactors();
      const existing = listed.data?.totp?.[0];
      if (existing) { setFactor({ id: existing.id, qr: "", secret: "" }); return; }
      const enrolled = await auth.mfa.enroll({ factorType: "totp", friendlyName: "Maison de Moments staff" });
      if (enrolled.error || !enrolled.data) { setMessage(enrolled.error?.message ?? "Could not start verification"); return; }
      setEnrolling(true);
      setFactor({ id: enrolled.data.id, qr: enrolled.data.totp.qr_code, secret: enrolled.data.totp.secret });
    }).catch(() => setMessage("Sign in before completing staff verification."));
  }, []);

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!factor) return;
    setBusy(true); setMessage("");
    const auth = createClient().auth;
    const challenge = await auth.mfa.challenge({ factorId: factor.id });
    if (challenge.error || !challenge.data) { setMessage(challenge.error?.message ?? "Could not start challenge"); setBusy(false); return; }
    const result = await auth.mfa.verify({ factorId: factor.id, challengeId: challenge.data.id, code });
    if (result.error) { setMessage(result.error.message); setBusy(false); return; }
    window.location.assign(safeReturnTo());
  }

  return <main className="login-page"><section className="login-card"><Link href="/" className="workspace-brand"><span>MM</span><strong>Maison de Moments</strong></Link><p className="workspace-kicker">Staff security</p><h1>{enrolling ? "Set up your authenticator" : "Verify your identity"}</h1><p>{enrolling ? "Scan this code in your authenticator app, then enter its six-digit code." : "Enter the current code from your authenticator app."}</p>{enrolling && factor?.qr ? <><Image unoptimized src={`data:image/svg+xml;utf8,${encodeURIComponent(factor.qr)}`} alt="Authenticator setup QR code" width={200} height={200} /><p>Manual setup key: <code>{factor.secret}</code></p></> : null}<form onSubmit={(event) => void verify(event)}><label>Authenticator code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label><button className="workspace-button" disabled={busy || !factor || code.length !== 6}>{busy ? "Verifying…" : "Continue"}</button></form>{message ? <p role="alert" className="login-message">{message}</p> : null}</section></main>;
}

function safeReturnTo() {
  const value = new URLSearchParams(window.location.search).get("returnTo");
  if (!value?.startsWith("/") || value.startsWith("//")) return "/studio";
  const resolved = new URL(value, window.location.origin);
  return resolved.origin === window.location.origin ? resolved.pathname + resolved.search + resolved.hash : "/studio";
}
