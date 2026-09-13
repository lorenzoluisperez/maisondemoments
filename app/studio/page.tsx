"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Eye, Layers3, RotateCcw, Save, Search, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";
import { demoJobs } from "@/lib/demo-jobs";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function StudioPage() {
  const [selectedJob, setSelectedJob] = useState(demoJobs[0]);
  const [scale, setScale] = useState([100]);
  const [rotation, setRotation] = useState([0]);
  const [saved, setSaved] = useState(true);
  return (
    <AppShell area="studio">
      <header className="workspace-header">
        <div><p className="workspace-kicker">Production studio</p><h1>Today&apos;s work</h1></div>
        <div className="search-box"><Search /><Input aria-label="Search jobs" placeholder="Search JO or customer" /></div>
      </header>
      <section className="queue-summary">
        <div><span>Ready to start</span><strong>4</strong></div><div><span>In design</span><strong>3</strong></div><div><span>Client review</span><strong>6</strong></div><div><span>Due this week</span><strong>5</strong></div>
      </section>
      <div className="job-table">
        <Table>
          <TableHeader><TableRow><TableHead>Job order</TableHead><TableHead>Customer</TableHead><TableHead>Event</TableHead><TableHead>Next action</TableHead><TableHead>Due</TableHead></TableRow></TableHeader>
          <TableBody>{demoJobs.map((job) => <TableRow key={job.number} data-selected={selectedJob.number === job.number} onClick={() => setSelectedJob(job)}><TableCell><strong>{job.number}</strong></TableCell><TableCell>{job.customer}</TableCell><TableCell>{job.event}</TableCell><TableCell>{job.next}</TableCell><TableCell>{job.due}</TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
      <section className="studio-editor">
        <div className="editor-toolbar">
          <div><p className="workspace-kicker">{selectedJob.number}</p><h2>{selectedJob.customer}</h2></div>
          <div><span className={saved ? "save-state saved" : "save-state"}>{saved ? <CheckCircle2 /> : <Save />}{saved ? "Saved" : "Unsaved"}</span><Link href="/i/wedding-midnight-garden-demo" className="workspace-button secondary"><Eye /> Preview</Link><button className="workspace-button">Create review</button></div>
        </div>
        <div className="editor-grid">
          <aside className="scene-list"><h3>Scenes</h3>{["Opening", "Welcome", "Details", "Wedding party", "RSVP"].map((label, index) => <button className={index === 1 ? "active" : ""} key={label}><span>{index + 1}</span>{label}<Layers3 /></button>)}</aside>
          <div className="editor-canvas">
            <div className="phone-preview"><Image src="/maison-botanical.webp" width="768" height="1152" alt="" /><p>Together with their families</p><h3>Isabella <em>&amp;</em> Mateo</h3><span>September 20, 2026</span><div className="safe-area">Mobile safe area</div></div>
          </div>
          <aside className="property-panel">
            <div className="panel-title"><SlidersHorizontal /><h3>Floral cluster</h3></div>
            <label>Scale <output>{scale[0]}%</output><Slider value={scale} onValueChange={(value) => { setScale(value); setSaved(false); }} min={30} max={180} step={1} /></label>
            <label>Rotation <output>{rotation[0]}°</output><Slider value={rotation} onValueChange={(value) => { setRotation(value); setSaved(false); }} min={-45} max={45} step={1} /></label>
            <div className="form-columns"><label>X position<Input type="number" defaultValue="8" onChange={() => setSaved(false)} /></label><label>Y position<Input type="number" defaultValue="62" onChange={() => setSaved(false)} /></label></div>
            <label>Layer<Input type="number" defaultValue="2" onChange={() => setSaved(false)} /></label>
            <button className="reset-button" onClick={() => { setScale([100]); setRotation([0]); setSaved(false); }}><RotateCcw /> Reset overrides</button>
            <button className="workspace-button full" onClick={() => setSaved(true)}><Save /> Save composition</button>
          </aside>
        </div>
      </section>
    </AppShell>
  );
}
