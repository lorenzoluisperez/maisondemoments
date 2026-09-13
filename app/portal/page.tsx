"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Clock3, Link2, MessageSquareText, ShieldCheck, UsersRound } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function PortalPage() {
  const [saved, setSaved] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<"pending" | "approved" | "changes">("pending");
  const [households, setHouseholds] = useState(2);
  return (
    <AppShell area="portal">
      <header className="workspace-header">
        <div><p className="workspace-kicker">JO-2026-000127</p><h1>Isabella &amp; Mateo</h1></div>
        <Link className="workspace-button secondary" href="/i/wedding-midnight-garden-demo">Preview invitation</Link>
      </header>
      <section className="portal-overview">
        <div><p>Brief completion</p><strong>78%</strong><Progress value={78} /></div>
        <div><p>Current stage</p><strong>In production</strong><span><Clock3 /> Review expected September 2</span></div>
        <div><p>Payment</p><strong>Deposit confirmed</strong><span><Check /> Balance due before publication</span></div>
      </section>
      <Tabs defaultValue="details" className="workspace-tabs">
        <TabsList variant="line"><TabsTrigger value="details">Event details</TabsTrigger><TabsTrigger value="guests">Guest households</TabsTrigger><TabsTrigger value="review">Review</TabsTrigger></TabsList>
        <TabsContent value="details">
          <div className="workspace-grid">
            <aside className="task-list">
              <button className="complete"><Check /> Names &amp; date <ChevronRight /></button>
              <button className="active">2 Venues &amp; schedule <ChevronRight /></button>
              <button>3 Wedding party <ChevronRight /></button>
              <button>4 Dress code &amp; gifts <ChevronRight /></button>
              <button>5 Photos <ChevronRight /></button>
            </aside>
            <form className="workspace-form" onSubmit={(event) => { event.preventDefault(); setSaved(true); }}>
              <div><p className="workspace-kicker">Section 2 of 5</p><h2>Venues &amp; schedule</h2><p>These details flow directly into the invitation. Your designer will handle the presentation.</p></div>
              <label>Ceremony venue<Input defaultValue="Casa de Memoria" /></label>
              <label>Street address<Input defaultValue="Tagaytay, Cavite" /></label>
              <div className="form-columns"><label>Date<Input type="date" defaultValue="2026-09-20" /></label><label>Time<Input type="time" defaultValue="15:30" /></label></div>
              <label>Directions link<Input type="url" defaultValue="https://maps.google.com" /></label>
              <label>Notes for guests<Textarea defaultValue="Please arrive 30 minutes before the ceremony." /></label>
              <div className="form-actions"><span>{saved ? "Changes saved" : "Saved automatically"}</span><button className="workspace-button" type="submit">Save &amp; continue</button></div>
            </form>
          </div>
        </TabsContent>
        <TabsContent value="guests">
          <section className="portal-panel">
            <div className="panel-heading"><div><p className="workspace-kicker">Private distribution</p><h2>Household invitations</h2><p>Each household receives one revocable link and can only select its allocated seats.</p></div><button className="workspace-button" onClick={() => setHouseholds((count) => count + 1)}>Add household</button></div>
            <div className="household-list">
              <div><UsersRound /><span><strong>The Flores household</strong><small>2 adult seats · Link issued</small></span><button><Link2 /> Copy link</button></div>
              <div><UsersRound /><span><strong>Ninang Celia</strong><small>1 adult seat · No response</small></span><button><Link2 /> Copy link</button></div>
              {households > 2 && <div><UsersRound /><span><strong>New household</strong><small>1 adult seat · Link not issued</small></span><button>Configure</button></div>}
            </div>
            <p className="panel-footnote"><ShieldCheck /> Forwarded links grant the same household access. Revoke and reissue a link if it is shared incorrectly.</p>
          </section>
        </TabsContent>
        <TabsContent value="review">
          <section className="portal-panel review-panel">
            <div className="panel-heading"><div><p className="workspace-kicker">Frozen review version</p><h2>Invitation version 1</h2><p>Issued August 27 · Theme midnight-garden@1.0.0 · Renderer v1</p></div><Link className="workspace-button secondary" href="/i/wedding-midnight-garden-demo">Open full preview</Link></div>
            <div className="version-facts"><span><strong>Review status</strong>{reviewDecision === "pending" ? "Awaiting your decision" : reviewDecision === "approved" ? "Approved for publication" : "Consolidated changes requested"}</span><span><strong>Revision rounds</strong>0 of 2 used</span><span><strong>Content hash</strong>3b6e…d91f</span></div>
            {reviewDecision === "pending" ? <div className="review-actions"><button className="workspace-button" onClick={() => setReviewDecision("approved")}><Check /> Approve this version</button><button className="workspace-button secondary" onClick={() => setReviewDecision("changes")}><MessageSquareText /> Request consolidated changes</button></div> : <div className="decision-notice"><ShieldCheck /><p><strong>Decision recorded for version 1</strong><br />Any later draft edit will require a new review version.</p><button onClick={() => setReviewDecision("pending")}>Reset demo</button></div>}
          </section>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
