"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Eye, PauseCircle, RotateCcw, Send, Undo2 } from "lucide-react";

type History = {
  invitation: { id: string; liveVersionId: string | null; availability: string; expiresAt: string; publishedAt: string | null; reviewState: string | null; draftRevision: number | null } | null;
  versions: Array<{ id: string; number: number; sourceRevision: number; contentHash: string; rendererVersion: string; materialChanges: Array<{ kind: string; label: string }>; createdAt: string; approvedAt: string | null; changesRequestedAt: string | null; live: boolean; current: boolean }>;
  balance: { quotedAmountMinor: number; paidAmountMinor: number; outstandingAmountMinor: number; currency: string } | null;
  permissions: { canPublish: boolean };
};

export function ReviewPublishingPanel({ orderId, revision, reviewState, saveState, onRefresh }: { orderId: string; revision: number; reviewState: string; saveState: string; onRefresh: () => Promise<void> }) {
  const [history, setHistory] = useState<History | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [reason, setReason] = useState("");
  const [checklist, setChecklist] = useState({ contentVerified: false, responsiveChecked: false, accessibilityChecked: false, mediaChecked: false });

  const loadHistory = useCallback(async () => {
    const response = await fetch(`/api/orders/${orderId}/reviews`, { cache: "no-store", credentials: "same-origin" });
    const body = await response.json() as { history?: History; error?: string };
    if (!response.ok || !body.history) throw new Error(body.error ?? "Review history could not be loaded");
    setHistory(body.history);
  }, [orderId]);
  useEffect(() => { void (async () => { try { await loadHistory(); } catch (error) { setMessage(error instanceof Error ? error.message : "Review history could not be loaded"); } })(); }, [loadHistory]);

  async function createReview() {
    setWorking(true); setMessage(null);
    try {
      const response = await fetch(`/api/studio/orders/${orderId}/reviews`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: revision, checklist }) });
      const body = await response.json() as { review?: { version: { number: number } }; error?: string };
      if (!response.ok || !body.review) throw new Error(body.error ?? "Review version could not be created");
      setMessage(`Review ${body.review.version.number} is ready for the customer.`);
      await Promise.all([loadHistory(), onRefresh()]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Review version could not be created"); }
    finally { setWorking(false); }
  }

  async function publicationAction(path: "publish" | "rollback", versionId: string) {
    const invitation = history?.invitation;
    if (!invitation) return;
    if (!window.confirm(path === "publish" ? "Publish this exact approved version now?" : "Point the live invitation back to this approved version?")) return;
    setWorking(true); setMessage(null);
    try {
      const response = await fetch(`/api/admin/invitations/${invitation.id}/${path}`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId }) });
      const body = await response.json() as { history?: History; error?: string };
      if (!response.ok || !body.history) throw new Error(body.error ?? "Publication action failed");
      setHistory(body.history); await onRefresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Publication action failed"); }
    finally { setWorking(false); }
  }

  async function availabilityAction(action: "suspend" | "resume" | "expire") {
    const invitation = history?.invitation;
    if (!invitation || reason.trim().length < 3) return;
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} this invitation?`)) return;
    setWorking(true); setMessage(null);
    try {
      const response = await fetch(`/api/admin/invitations/${invitation.id}/availability`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
      const body = await response.json() as { history?: History; error?: string };
      if (!response.ok || !body.history) throw new Error(body.error ?? "Availability could not be changed");
      setHistory(body.history); setReason(""); await onRefresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Availability could not be changed"); }
    finally { setWorking(false); }
  }

  const allChecked = Object.values(checklist).every(Boolean);
  const canCreate = (reviewState === "EDITING" || reviewState === "CHANGES_REQUESTED") && saveState === "saved" && allChecked;
  const latest = history?.versions[0];
  return <section className="review-publishing-panel"><header><div><p className="workspace-kicker">Review and publication</p><h3>{reviewState.replaceAll("_", " ")}</h3></div>{latest ? <Link className="workspace-button secondary" href={`/review/${latest.id}`} target="_blank"><Eye /> Open latest review</Link> : null}</header>
    {message ? <div className="workspace-alert"><AlertCircle />{message}</div> : null}
    <div className="review-production-grid"><div className="qa-checklist"><h4>Internal QA checklist</h4>{Object.entries({ contentVerified: "Names, dates, venues, and wording", responsiveChecked: "Mobile and wide layouts", accessibilityChecked: "Keyboard, focus, and reduced motion", mediaChecked: "Artwork and customer media" }).map(([key, label]) => <label key={key}><input type="checkbox" checked={checklist[key as keyof typeof checklist]} onChange={(change) => setChecklist((current) => ({ ...current, [key]: change.target.checked }))} />{label}</label>)}<button className="workspace-button" disabled={!canCreate || working} onClick={() => void createReview()}><Send /> Create frozen client review</button>{reviewState === "IN_REVIEW" ? <p>The draft is locked while the customer reviews it.</p> : reviewState === "APPROVED" ? <p>The exact current version is approved and ready for an admin publication check.</p> : null}</div>
      <div className="version-history"><h4>Version history</h4>{history?.balance ? <p className={history.balance.outstandingAmountMinor ? "balance-due" : "balance-paid"}>Balance: {money(history.balance.outstandingAmountMinor, history.balance.currency)} outstanding</p> : null}{history?.versions.length ? history.versions.map((version) => {
        const action = version.current && history.invitation?.reviewState === "APPROVED" ? "publish" : history.invitation?.liveVersionId ? "rollback" : null;
        const blockedByBalance = action === "publish" && Boolean(history.balance?.outstandingAmountMinor);
        return <article key={version.id}><div><strong>Version {version.number}</strong>{version.live ? <span>Live</span> : !version.current ? <span>Superseded</span> : version.approvedAt ? <span>Approved</span> : version.changesRequestedAt ? <span>Changes requested</span> : <span>In review</span>}</div><p>{version.materialChanges.map((change) => change.label).join(" · ")}</p><small>{version.contentHash.slice(0, 12)} · {new Date(version.createdAt).toLocaleString()}</small><div className="version-actions"><Link href={`/review/${version.id}`} target="_blank"><Eye /> Review</Link>{history.permissions.canPublish && version.approvedAt && !version.live && action ? <button disabled={working || blockedByBalance} onClick={() => void publicationAction(action, version.id)}>{action === "publish" ? <Send /> : <Undo2 />}{action === "publish" ? "Publish" : "Rollback"}</button> : null}</div></article>;
      }) : <p>No review versions yet.</p>}</div>
      {history?.permissions.canPublish && history.invitation?.liveVersionId ? <div className="availability-controls"><h4>Live access</h4><p>Status: <strong>{history.invitation.availability}</strong></p><label>Required reason<input value={reason} onChange={(change) => setReason(change.target.value)} placeholder="Reason recorded in the audit trail" /></label><div>{history.invitation.availability === "LIVE" ? <button disabled={working || reason.trim().length < 3} onClick={() => void availabilityAction("suspend")}><PauseCircle /> Suspend</button> : null}{history.invitation.availability === "SUSPENDED" ? <button disabled={working || reason.trim().length < 3} onClick={() => void availabilityAction("resume")}><CheckCircle2 /> Resume</button> : null}{history.invitation.availability === "LIVE" || history.invitation.availability === "SUSPENDED" ? <button disabled={working || reason.trim().length < 3} onClick={() => void availabilityAction("expire")}><RotateCcw /> Expire</button> : null}</div></div> : null}
    </div></section>;
}

function money(value: number, currency: string) { return new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(value / 100); }
