"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export function CheckoutForm({ slug, tier, priceMinor, turnaroundDays, termsUrl, cancellationUrl, taxNotice, existingPurchaseId }: {
  slug: string; tier: "ESSENTIAL" | "SIGNATURE" | "COUTURE"; priceMinor: number; turnaroundDays: number;
  termsUrl: string; cancellationUrl: string; taxNotice: string; existingPurchaseId?: string;
}) {
  const [contactName, setContactName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Manila");
  const [purchaseId, setPurchaseId] = useState(existingPurchaseId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  async function proceed(event: FormEvent) {
    event.preventDefault();
    if (!accepted || busy) return;
    setBusy(true); setError("");
    try {
      let id = purchaseId;
      if (!id) {
        const created = await fetch("/api/commerce/purchases", {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
          body: JSON.stringify({ productSlug: slug, tier, eventDate, timezone, contactName, acceptedTerms: true }),
        });
        const data = await created.json() as { purchase?: { id: string }; error?: string };
        if (created.status === 401) { window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`; return; }
        if (!created.ok || !data.purchase) throw new Error(data.error ?? "Could not save your details");
        id = data.purchase.id;
        setPurchaseId(id);
      }
      const response = await fetch(`/api/commerce/purchases/${id}/checkout`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: "{}",
      });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "Could not prepare payment");
      window.location.assign(data.url);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not continue to payment");
      setBusy(false);
    }
  }

  return <form className="commerce-form" onSubmit={(event) => void proceed(event)}>
    {!existingPurchaseId ? <><label>Your name<input required autoComplete="name" maxLength={160} value={contactName} onChange={(event) => setContactName(event.target.value)} /></label><label>Wedding date<input required type="date" min={new Date().toISOString().slice(0, 10)} value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label><label>Event timezone<input required value={timezone} maxLength={80} onChange={(event) => setTimezone(event.target.value)} /><small>For example, Asia/Manila</small></label></> : <p>Your details and the agreed price are saved. Continue to your secure payment page.</p>}
    <div className="commerce-summary"><strong>{new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(priceMinor / 100)}</strong><span>Full payment in PHP</span><small>Production starts after payment and a complete brief. Typical production: {turnaroundDays} days. {taxNotice}</small></div>
    <label className="commerce-consent"><input required type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>I have read the <a href={termsUrl} target="_blank" rel="noreferrer">service terms</a> and <a href={cancellationUrl} target="_blank" rel="noreferrer">cancellation policy</a>.</span></label>
    {error ? <p className="commerce-error" role="alert">{error}</p> : null}
    <button className="boutique-button" disabled={busy || !accepted}>{busy ? "Preparing your payment…" : "Continue to secure payment"}</button>
    <p className="commerce-help">Already purchased? <Link href="/portal">Go to your invitation</Link>.</p>
  </form>;
}
