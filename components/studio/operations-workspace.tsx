"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";

type Dashboard = {
  generatedAt: string;
  queues: Array<{ key: string; total: number }>;
  failedJobs: Array<{ id: string; kind: string; attempts: number; lastErrorCode: string | null }>;
  backupSummary: Array<{ state: string; total: number }>;
  notificationSummary: Array<{ state: string; total: number }>;
  overdueOrders: Array<{ id: string; jobNumber: string; state: string; dueDate: string; customerName: string }>;
};

const labels: Record<string, string> = { waiting_content: "Waiting for content", ready: "Ready for production", in_design: "In design", waiting_review: "Waiting for review", changes_requested: "Changes requested", approved_unpublished: "Approved, awaiting publication", due_next_7_days: "Due in 7 days" };

export function OperationsWorkspace() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setError(null);
    const response = await fetch("/api/admin/operations", { cache: "no-store", credentials: "same-origin" });
    const body = await response.json() as { dashboard?: Dashboard; error?: string };
    if (!response.ok || !body.dashboard) { setError(body.error ?? "Operations could not be loaded"); return; }
    setDashboard(body.dashboard);
  }
  async function retry(jobId: string) { const response = await fetch(`/api/admin/operations/jobs/${jobId}/retry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); const body = await response.json() as { error?: string }; if (!response.ok) { setError(body.error ?? "Task could not be retried"); return; } await load(); }
  useEffect(() => { void (async () => { await load(); })(); }, []);
  return <AppShell area="studio"><header className="workspace-header"><div><p className="workspace-kicker">Operations</p><h1>Production health</h1></div><button className="workspace-button secondary" onClick={() => void load()}><RefreshCw /> Refresh</button></header>
    {error ? <div className="workspace-alert"><AlertCircle />{error}</div> : null}
    <section className="queue-summary">{dashboard?.queues.map((queue) => <div key={queue.key}><span>{labels[queue.key] ?? queue.key}</span><strong>{queue.total}</strong></div>)}</section>
    <section className="operations-grid"><article className="job-table"><h2>Overdue orders</h2>{dashboard?.overdueOrders.length ? dashboard.overdueOrders.map((order) => <p key={order.id}><strong>{order.jobNumber}</strong> · {order.customerName} · {order.state.replaceAll("_", " ")} · {order.dueDate}</p>) : <p>No overdue active orders.</p>}</article>
      <article className="job-table"><h2>Failed durable tasks</h2>{dashboard?.failedJobs.length ? dashboard.failedJobs.map((job) => <p key={job.id}><strong>{job.kind}</strong> · {job.lastErrorCode ?? "Unknown error"} · {job.attempts} attempts <button onClick={() => void retry(job.id)}>Retry</button></p>) : <p>No failed tasks.</p>}</article>
      <article className="job-table"><h2>Media backups</h2>{dashboard?.backupSummary.length ? dashboard.backupSummary.map((item) => <p key={item.state}><strong>{item.state}</strong> · {item.total}</p>) : <p>No media awaiting backup.</p>}</article>
      <article className="job-table"><h2>Email deliveries</h2>{dashboard?.notificationSummary.length ? dashboard.notificationSummary.map((item) => <p key={item.state}><strong>{item.state}</strong> · {item.total}</p>) : <p>No email deliveries recorded.</p>}</article>
    </section>
  </AppShell>;
}
