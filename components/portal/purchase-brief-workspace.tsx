"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/workspace/app-shell";
import { IdentityFields, PeopleFields, ScheduleFields, WordingFields } from "@/components/portal/portal-workspace";
import { WeddingDetailsFields } from "@/components/portal/wedding-details-fields";
import { emptyWeddingDetails } from "@/lib/products/content";
import type { EventBriefDocument } from "@/lib/content/brief";
import { weddingProduct } from "@/lib/products/catalog";

type PurchaseBrief = {
  purchase: { id: string; productSlug: string; tier: string; status: string; jobOrderId: string | null };
  document: EventBriefDocument | null; revision: number;
  issues: Array<{ section: string; path: string; message: string }>;
};

export function PurchaseBriefWorkspace({ id }: { id: string }) {
  const [brief, setBrief] = useState<PurchaseBrief | null>(null);
  const [section, setSection] = useState<"identity" | "schedule" | "participants" | "wording" | "design">("identity");
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "conflict" | "error">("saved");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const changeVersion = useRef(0);
  const load = useCallback(async () => {
    const response = await fetch(`/api/commerce/purchases/${id}/brief`, { cache: "no-store" });
    const body = await response.json() as { brief?: PurchaseBrief; error?: string };
    if (!response.ok || !body.brief) throw new Error(body.error ?? "Could not load your details");
    setBrief(body.brief); setSaveState("saved"); setMessage("");
  }, [id]);
  useEffect(() => { void Promise.resolve().then(load).catch((error) => setMessage(error instanceof Error ? error.message : "Could not load your details")); }, [load]);
  const persist = useCallback(async (snapshot: PurchaseBrief, version: number) => {
    setSaveState("saving");
    const response = await fetch(`/api/commerce/purchases/${id}/brief`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: snapshot.revision, document: snapshot.document }),
    });
    const body = await response.json() as { brief?: PurchaseBrief; error?: string };
    if (response.status === 409) { setSaveState("conflict"); return; }
    if (!response.ok || !body.brief) { setSaveState("error"); setMessage(body.error ?? "Could not save"); return; }
    setBrief((current) => current ? { ...body.brief!, document: changeVersion.current === version ? body.brief!.document : current.document } : body.brief!);
    setSaveState(changeVersion.current === version ? "saved" : "unsaved");
  }, [id]);
  useEffect(() => {
    if (!brief?.document || saveState !== "unsaved") return;
    const timer = window.setTimeout(() => void persist(brief, changeVersion.current), 800);
    return () => window.clearTimeout(timer);
  }, [brief, persist, saveState]);
  function changeEvent(event: EventBriefDocument["event"]) {
    changeVersion.current += 1;
    setBrief((current) => current?.document ? { ...current, document: { ...current.document, event } } : current);
    setSaveState("unsaved"); setMessage("");
  }
  function changeDetails(details: NonNullable<EventBriefDocument["weddingDetails"]>) {
    changeVersion.current += 1;
    setBrief((current) => current?.document ? { ...current, document: { ...current.document, weddingDetails: details } } : current);
    setSaveState("unsaved"); setMessage("");
  }
  async function submit() {
    if (!brief || saveState !== "saved" || brief.issues.length) return;
    setSubmitting(true); setMessage("");
    const response = await fetch(`/api/commerce/purchases/${id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const body = await response.json() as { orderId?: string; error?: string };
    if (response.ok && body.orderId) window.location.assign(`/portal?order=${body.orderId}`);
    else { setMessage(body.error ?? "Could not submit"); setSubmitting(false); }
  }
  if (!brief?.document) return <AppShell area="portal"><section className="empty-workspace"><h1>{message || "Opening your invitation details…"}</h1>{brief?.purchase.jobOrderId ? <Link href={`/portal?order=${brief.purchase.jobOrderId}`}>Open production order</Link> : null}</section></AppShell>;
  const event = brief.document.event;
  return <AppShell area="portal"><header className="workspace-header"><div><p className="workspace-kicker">{weddingProduct(brief.purchase.productSlug)?.name} · {brief.purchase.tier}</p><h1>Make it yours</h1><p>Your answers save as you go. Our team will prepare the final invitation.</p></div></header><div className="workspace-grid"><aside className="task-list">{(["identity", "schedule", "participants", "wording", "design"] as const).map((item) => <button key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)}>{item === "identity" ? "Names and date" : item === "schedule" ? "Venues and schedule" : item === "participants" ? "People" : item === "wording" ? "Wording" : "Design details"}</button>)}</aside><section className="workspace-form"><div><p className="workspace-kicker">{section}</p><h2>{section === "identity" ? "Your celebration" : section === "schedule" ? "Where and when" : section === "participants" ? "Your people" : section === "wording" ? "Your words" : "Personal touches"}</h2><p>Photos and household links become available after this initial brief is submitted.</p></div>{section === "identity" ? <IdentityFields event={event} onChange={changeEvent} lockedBooking /> : null}{section === "schedule" ? <ScheduleFields event={event} onChange={changeEvent} /> : null}{section === "participants" ? <PeopleFields event={event} onChange={changeEvent} /> : null}{section === "wording" ? <WordingFields event={event} onChange={changeEvent} /> : null}{section === "design" ? <WeddingDetailsFields details={brief.document.weddingDetails ?? emptyWeddingDetails} onChange={changeDetails} /> : null}<div className="field-issues">{brief.issues.filter((issue) => issue.section === section).map((issue) => <p key={issue.path}>{issue.message}</p>)}</div>{saveState === "conflict" ? <button className="workspace-button secondary" onClick={() => void load()}>A newer copy exists. Reload it</button> : null}{message ? <p role="alert">{message}</p> : null}<div className="form-actions"><span>{saveState === "saved" ? "All changes saved" : saveState === "conflict" ? "Save conflict" : saveState === "error" ? "Save failed" : "Saving changes…"}</span><button className="workspace-button" disabled={saveState !== "saved" || brief.issues.length > 0 || submitting} onClick={() => void submit()}>{submitting ? "Submitting…" : "Submit wedding details"}</button></div></section></div></AppShell>;
}
