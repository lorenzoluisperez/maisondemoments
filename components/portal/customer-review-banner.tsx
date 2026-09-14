"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, MessageSquareText } from "lucide-react";

type History = { versions: Array<{ id: string; number: number; approvedAt: string | null; changesRequestedAt: string | null; live: boolean; current: boolean }> };

export function CustomerReviewBanner({ orderId }: { orderId: string }) {
  const [history, setHistory] = useState<History | null>(null);
  useEffect(() => { void fetch(`/api/orders/${orderId}/reviews`, { cache: "no-store", credentials: "same-origin" }).then(async (response) => {
    if (response.ok) setHistory((await response.json() as { history: History }).history);
  }); }, [orderId]);
  const latest = history?.versions[0];
  if (!latest) return null;
  const icon = latest.approvedAt ? <CheckCircle2 /> : latest.changesRequestedAt ? <MessageSquareText /> : <Eye />;
  const label = !latest.current ? `Review ${latest.number} is superseded by newer changes` : latest.approvedAt ? `Review ${latest.number} approved` : latest.changesRequestedAt ? `Changes requested for review ${latest.number}` : `Review ${latest.number} is ready`;
  return <section className="review-banner">{icon}<div><strong>{label}</strong><p>{latest.live ? "This is the currently published version." : "Open the frozen invitation and review the exact version."}</p></div><Link className="workspace-button" href={`/review/${latest.id}`}>Open review</Link></section>;
}
