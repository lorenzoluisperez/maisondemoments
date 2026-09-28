"use client";

import { useState, type FormEvent } from "react";

export function QuoteAcceptance({ quoteId, termsUrl, cancellationUrl, taxNotice }: { quoteId: string; termsUrl: string; cancellationUrl: string; taxNotice: string }) {
  const [contactName, setContactName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Manila");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!accepted || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/commerce/quotes/${quoteId}/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventDate, timezone, contactName, acceptedTerms: true }) });
      const body = await response.json() as { purchase?: { id: string }; error?: string };
      if (!response.ok || !body.purchase) throw new Error(body.error ?? "Could not accept the proposal");
      window.location.assign(`/checkout?purchase=${body.purchase.id}`);
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Could not accept the proposal"); setBusy(false); }
  }
  return <form className="commerce-form" onSubmit={(event) => void submit(event)}><label>Your name<input required maxLength={160} autoComplete="name" value={contactName} onChange={(event) => setContactName(event.target.value)} /></label><label>Wedding date<input required type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label><label>Event timezone<input required maxLength={80} value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label><p>{taxNotice}</p><label className="commerce-consent"><input type="checkbox" required checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>I accept this exact scope, exclusions, delivery time, price, <a href={termsUrl} target="_blank" rel="noreferrer">service terms</a>, and <a href={cancellationUrl} target="_blank" rel="noreferrer">cancellation policy</a>.</span></label>{message && <p role="alert">{message}</p>}<button className="boutique-button" disabled={busy || !accepted}>{busy ? "Saving…" : "Accept proposal and continue"}</button></form>;
}
