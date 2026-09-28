"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, MessageSquareText } from "lucide-react";

type History = { versions: Array<{ id: string; number: number; approvedAt: string | null; changesRequestedAt: string | null; live: boolean; current: boolean }> };

export function CustomerReviewBanner({ orderId, briefSubmitted, orderState, product }: { orderId: string; briefSubmitted: boolean; orderState: string; product: boolean }) {
  const [history, setHistory] = useState<History | null>(null);
  useEffect(() => { void fetch(`/api/orders/${orderId}/reviews`, { cache: "no-store", credentials: "same-origin" }).then(async (response) => {
    if (response.ok) setHistory((await response.json() as { history: History }).history);
  }); }, [orderId]);
  const latest = history?.versions[0];
  const designStarted = ["IN_PRODUCTION", "DELIVERED", "CLOSED"].includes(orderState) || Boolean(latest);
  const reviewReady = Boolean(latest?.current && !latest.changesRequestedAt);
  const reviewApproved = Boolean(latest?.current && latest.approvedAt);
  const published = Boolean(history?.versions.some((version) => version.live));
  const timeline = product ? <section className="production-timeline" aria-label="Invitation production timeline"><div><p>YOUR INVITATION JOURNEY</p><h2>From your details to your guests</h2></div><ol>
    <li data-state={briefSubmitted ? "done" : "current"}><span>01</span><strong>Your details</strong><small>{briefSubmitted ? "Submitted" : "Complete and submit your wedding information"}</small></li>
    <li data-state={designStarted ? "done" : briefSubmitted ? "current" : "waiting"}><span>02</span><strong>Designer preparation</strong><small>{designStarted ? "The invitation is being prepared" : "Begins after your complete brief and assignment"}</small></li>
    <li data-state={reviewApproved ? "done" : designStarted ? "current" : "waiting"}><span>03</span><strong>Your review</strong><small>{reviewApproved ? "Approved" : reviewReady ? "Review the exact version" : latest?.changesRequestedAt ? "Changes are being prepared" : "We will send a finished version for approval"}</small></li>
    <li data-state={published ? "done" : reviewApproved ? "current" : "waiting"}><span>04</span><strong>Share with guests</strong><small>{published ? "A version is published" : "Private household links follow publication"}</small></li>
  </ol></section> : null;
  if (!latest) return timeline;
  const icon = latest.approvedAt ? <CheckCircle2 /> : latest.changesRequestedAt ? <MessageSquareText /> : <Eye />;
  const label = !latest.current ? `Review ${latest.number} is superseded by newer changes` : latest.approvedAt ? `Review ${latest.number} approved` : latest.changesRequestedAt ? `Changes requested for review ${latest.number}` : `Review ${latest.number} is ready`;
  return <>{timeline}<section className="review-banner">{icon}<div><strong>{label}</strong><p>{latest.live ? "This is the currently published version." : "Open the frozen invitation and review the exact version."}</p></div><Link className="workspace-button" href={`/review/${latest.id}`}>Open review</Link></section></>;
}
