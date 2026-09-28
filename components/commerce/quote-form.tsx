"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function QuoteForm({ slug }: { slug: string }) {
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function send(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/commerce/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productSlug: slug, request }) });
      const body = await response.json() as { error?: string };
      if (response.status === 401) { router.push(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`); return; }
      if (!response.ok) throw new Error(body.error ?? "Could not send your request");
      router.push("/portal?quote=requested");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not send your request"); setBusy(false); }
  }
  return <form className="commerce-form" onSubmit={(event) => void send(event)}><label>Tell us what you would like to change<textarea required minLength={30} maxLength={6000} rows={10} value={request} onChange={(event) => setRequest(event.target.value)} placeholder="Describe the artwork, elements, colors, and feeling you have in mind. Mention anything you want to keep from the original." /></label><p>We will prepare a scoped proposal with the price, delivery timeline, included revisions, and exclusions before you pay.</p>{error ? <p className="commerce-error" role="alert">{error}</p> : null}<button className="boutique-button" disabled={busy}>{busy ? "Sending…" : "Request a proposal"}</button></form>;
}
