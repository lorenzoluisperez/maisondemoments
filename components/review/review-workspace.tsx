"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";

type FeedbackItem = { sectionKey: "general" | "opening" | "welcome" | "details" | "participants" | "rsvp"; message: string };
type ReviewData = {
  order: { id: string; jobNumber: string };
  invitation: { id: string; liveVersionId: string | null; availability: string };
  version: { id: string; number: number; sourceRevision: number; contentHash: string; rendererVersion: string; materialChanges: Array<{ kind: string; label: string }>; createdAt: string };
  reviewState: string;
  current: boolean;
  approval: { customerId: string; approvedAt: string } | null;
  changeRequest: { summary: string; createdAt: string; items: Array<FeedbackItem & { displayOrder: number }> } | null;
  permissions: { canDecide: boolean; canPublish: boolean };
  snapshot: { title: string; secondaryName?: string; dateLabel: string };
};

export function ReviewWorkspace({ versionId }: { versionId: string }) {
  const [review, setReview] = useState<ReviewData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [items, setItems] = useState<FeedbackItem[]>([{ sectionKey: "general", message: "" }]);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/reviews/${versionId}`, { cache: "no-store", credentials: "same-origin" });
    const body = await response.json() as { review?: ReviewData; error?: string };
    if (!response.ok || !body.review) throw new Error(response.status === 401 ? "Sign in to open this review" : body.error ?? "Review could not be loaded");
    setReview(body.review);
  }, [versionId]);

  useEffect(() => { void (async () => { try { await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "Review could not be loaded"); } })(); }, [load]);

  async function decide(action: "approve" | "changes") {
    if (!review) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/reviews/${review.version.id}/${action}`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "approve" ? {} : { summary, items }),
      });
      const body = await response.json() as { review?: ReviewData; error?: string };
      if (!response.ok || !body.review) throw new Error(body.error ?? "Your decision could not be saved");
      setReview(body.review);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Your decision could not be saved"); }
    finally { setSubmitting(false); }
  }

  if (!review) return <AppShell area="portal"><section className="empty-workspace"><AlertCircle /><h2>{message ?? "Loading your review"}</h2>{message?.includes("Sign in") ? <Link className="workspace-button" href={`/login?returnTo=/review/${versionId}`}>Sign in</Link> : null}</section></AppShell>;
  const decisionLabel = review.approval ? "Approved" : review.changeRequest ? "Changes requested" : review.current ? "Awaiting your decision" : "Previous version";

  return <AppShell area="portal"><header className="workspace-header"><div><p className="workspace-kicker">{review.order.jobNumber} · Review {review.version.number}</p><h1>{review.snapshot.title}{review.snapshot.secondaryName ? ` & ${review.snapshot.secondaryName}` : ""}</h1></div><Link className="workspace-button secondary" href="/portal">Back to portal</Link></header>
    {message ? <div className="workspace-alert"><AlertCircle />{message}</div> : null}
    <section className="review-layout"><div className="review-preview"><div className="preview-toolbar"><span>Frozen version {review.version.number}</span><strong>{review.snapshot.dateLabel}</strong></div><iframe title={`Invitation review version ${review.version.number}`} src={`/review/${review.version.id}/preview`} /></div>
      <aside className="review-decision"><p className="workspace-kicker">{decisionLabel}</p><h2>Review this exact version</h2><p>Check names, dates, venues, wording, photographs, and the full invitation on mobile and desktop before deciding.</p>
        <div className="material-changes"><strong>What changed</strong>{review.version.materialChanges.map((change) => <span key={`${change.kind}-${change.label}`}><Check />{change.label}</span>)}</div>
        {review.approval ? <div className="decision-result success"><CheckCircle2 /><div><strong>Version {review.version.number} approved</strong><p>Approved {new Date(review.approval.approvedAt).toLocaleString()}</p></div></div> : null}
        {review.changeRequest ? <div className="decision-result"><AlertCircle /><div><strong>{review.changeRequest.summary}</strong>{review.changeRequest.items.map((item) => <p key={item.displayOrder}>{item.sectionKey}: {item.message}</p>)}</div></div> : null}
        {review.permissions.canDecide ? <><label className="approval-check"><input type="checkbox" checked={confirmed} onChange={(change) => setConfirmed(change.target.checked)} />I confirm that the names, date, venues, and wording in version {review.version.number} are correct.</label><button className="workspace-button" disabled={!confirmed || submitting} onClick={() => void decide("approve")}><CheckCircle2 /> Approve version {review.version.number}</button>
          <div className="feedback-form"><h3>Or request consolidated changes</h3><label>Summary<textarea rows={3} value={summary} onChange={(change) => setSummary(change.target.value)} placeholder="Summarize the changes needed in this round" /></label>{items.map((item, index) => <div className="feedback-item" key={index}><select aria-label={`Feedback section ${index + 1}`} value={item.sectionKey} onChange={(change) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, sectionKey: change.target.value as FeedbackItem["sectionKey"] } : entry))}><option value="general">General</option><option value="opening">Opening</option><option value="welcome">Welcome</option><option value="details">Details</option><option value="participants">Participants</option><option value="rsvp">RSVP</option></select><textarea aria-label={`Feedback message ${index + 1}`} rows={3} value={item.message} onChange={(change) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, message: change.target.value } : entry))} placeholder="Describe one specific change" />{items.length > 1 ? <button aria-label={`Remove feedback item ${index + 1}`} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button> : null}</div>)}<button className="reset-button" disabled={items.length >= 30} onClick={() => setItems((current) => [...current, { sectionKey: "general", message: "" }])}><Plus /> Add feedback item</button><button className="workspace-button secondary" disabled={submitting || !summary.trim() || items.some((item) => !item.message.trim())} onClick={() => void decide("changes")}><AlertCircle /> Request these changes</button></div></> : null}
        <p className="version-proof">Version hash <code>{review.version.contentHash.slice(0, 12)}</code> · Renderer {review.version.rendererVersion}</p>
      </aside></section></AppShell>;
}
