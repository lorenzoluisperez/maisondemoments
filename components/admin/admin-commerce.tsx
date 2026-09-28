"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/workspace/app-shell";
import { weddingProducts } from "@/lib/products/catalog";

type Offer = { id: string; productSlug: string; tier: "ESSENTIAL" | "SIGNATURE"; priceMinor: number | null; turnaroundDays: number | null; enabled: boolean };
type Quote = { id: string; customerId: string; productSlug: string; request: string; state: string; scope: string | null; exclusions: string | null; revisionRounds: number | null; deliveryDays: number | null; priceMinor: number | null };
type Purchase = { id: string; customerId: string; productSlug: string; tier: string; status: string; priceMinor: number; createdAt: string; jobOrderId: string | null };
type Attempt = { id: string; purchaseId: string; state: string; providerSessionId: string | null; providerPaymentId: string | null; updatedAt: string };
type Designer = { id: string; name: string };
type ProductionOrder = { id: string; assignedDesignerId: string | null; state: string; submittedAt: string | null; reviewState: string | null; availability: string | null };
type Metric = { productSlug: string; tier: string; stage: string; count: number };
type Cost = { id: string; purchaseId: string; category: string; minutes: number | null; amountMinor: number; note: string; voidedAt: string | null };
type TierEconomics = { tier: string; orderCount: number; revenueMinor: number | string; costMinor: number | string; laborMinutes: number };
type Dashboard = { offers: Offer[]; quotes: Quote[]; purchases: Purchase[]; attempts: Attempt[]; designers: Designer[]; productionOrders: ProductionOrder[]; metrics: Metric[]; costs: Cost[]; tierEconomics: TierEconomics[]; checkoutReady: boolean; observedAt: string };
const php = (minor: number | null) => minor === null ? "Not set" : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(minor / 100);

export function AdminCommerce() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/commerce/admin", { cache: "no-store" });
    const body = await response.json() as Dashboard & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "Could not load operations");
    setDashboard(body);
  }, []);
  useEffect(() => { void Promise.resolve().then(load).catch((failure) => setError(failure instanceof Error ? failure.message : "Could not load operations")); }, [load]);
  if (!dashboard) return <AppShell area="admin"><section className="empty-workspace"><h1>Business admin</h1><p>{error || "Loading today’s work…"}</p></section></AppShell>;
  const exceptions = dashboard.attempts.filter((attempt) => {
    const age = new Date(dashboard.observedAt).getTime() - new Date(attempt.updatedAt).getTime();
    return attempt.state === "FAILED" || (attempt.state === "CREATING" && age > 2 * 60_000) ||
      (attempt.state === "OPEN" && age > 15 * 60_000) ||
      (attempt.state === "PAID" && dashboard.purchases.some((purchase) => purchase.id === attempt.purchaseId && purchase.status === "AWAITING_PAYMENT"));
  });
  const awaitingAssignment = dashboard.productionOrders.filter((order) => order.submittedAt && !order.assignedDesignerId && order.state === "COLLECTING").length;
  const inDesign = dashboard.productionOrders.filter((order) => ["READY", "IN_PRODUCTION"].includes(order.state) && order.reviewState !== "IN_REVIEW" && order.reviewState !== "APPROVED").length;
  const awaitingApproval = dashboard.productionOrders.filter((order) => order.reviewState === "IN_REVIEW").length;
  const readyToPublish = dashboard.productionOrders.filter((order) => order.reviewState === "APPROVED" && order.availability === "UNPUBLISHED").length;
  const funnelCount = (stage: string) => dashboard.metrics.filter((item) => item.stage === stage).reduce((total, item) => total + item.count, 0);
  return <AppShell area="admin"><header className="workspace-header"><div><p className="workspace-kicker">Maison de Moments · Operations</p><h1>Keep every celebration moving.</h1><p>Pricing, proposals, payment intake, and production at a glance.</p></div><Link className="workspace-button" href="/studio">Open studio</Link></header>
    {!dashboard.checkoutReady && <p className="workspace-alert" role="status">Checkout is closed. Complete the staging and launch gates, then enable the commerce checkout setting.</p>}
    {error && <p className="workspace-alert" role="alert">{error}</p>}
    <section className="admin-metrics" aria-label="Action queues"><article><strong>{dashboard.purchases.filter((purchase) => purchase.status === "PAID").length}</strong><span>Paid, awaiting details</span></article><article><strong>{awaitingAssignment}</strong><span>Ready for assignment</span></article><article><strong>{inDesign}</strong><span>In design</span></article><article><strong>{awaitingApproval}</strong><span>Awaiting customer approval</span></article><article><strong>{readyToPublish}</strong><span>Approved, check publication</span></article><article><strong>{dashboard.quotes.filter((quote) => quote.state === "REQUESTED").length}</strong><span>Quotes to prepare</span></article><article><strong>{exceptions.length}</strong><span>Payment exceptions</span></article></section>
    <section className="admin-panel"><div className="admin-panel-heading"><div><p className="workspace-kicker">Last 30 days</p><h2>Business funnel</h2></div><p>Aggregate counts only. Design views are counted once per tab session.</p></div><div className="admin-metrics"><article><strong>{funnelCount("PRODUCT_VIEW")}</strong><span>Design views</span></article><article><strong>{funnelCount("CHECKOUT_STARTED")}</strong><span>Checkouts started</span></article><article><strong>{funnelCount("PAID")}</strong><span>Paid purchases</span></article><article><strong>{funnelCount("QUOTE_REQUESTED")}</strong><span>Couture requests</span></article><article><strong>{funnelCount("REFUNDED")}</strong><span>Full refunds</span></article></div></section>
    <section className="admin-panel"><div className="admin-panel-heading"><div><p className="workspace-kicker">Last 30 days</p><h2>Recorded economics by tier</h2></div><p>Contribution is revenue after recorded costs. Include labor, artwork, payment fees, and other costs before using it for pricing decisions.</p></div><div className="admin-table-wrap"><table className="admin-economics"><thead><tr><th>Tier</th><th>Paid orders</th><th>Revenue after full refunds</th><th>Recorded costs</th><th>Recorded labor</th><th>Contribution</th></tr></thead><tbody>{dashboard.tierEconomics.map((tier) => <tr key={tier.tier}><th>{tier.tier.toLowerCase()}</th><td>{tier.orderCount}</td><td>{php(Number(tier.revenueMinor))}</td><td>{php(Number(tier.costMinor))}</td><td>{(tier.laborMinutes / 60).toFixed(1)} h</td><td>{php(Number(tier.revenueMinor) - Number(tier.costMinor))}</td></tr>)}</tbody></table>{dashboard.tierEconomics.length === 0 && <p>No paid purchases in this period.</p>}</div></section>
    <section className="admin-panel"><div className="admin-panel-heading"><div><p className="workspace-kicker">Catalog</p><h2>Published packages</h2></div><p>Prices are in PHP and snapshotted when purchased.</p></div><div className="admin-offer-grid">{weddingProducts.flatMap((product) => (["ESSENTIAL", "SIGNATURE"] as const).map((tier) => { const offer = dashboard.offers.find((row) => row.productSlug === product.slug && row.tier === tier); return <OfferEditor key={`${product.slug}-${tier}`} slug={product.slug} name={product.name} tier={tier} offer={offer} onSaved={() => void load()} />; }))}</div></section>
    <section className="admin-panel"><div className="admin-panel-heading"><div><p className="workspace-kicker">Bespoke work</p><h2>Couture proposals</h2></div></div>{dashboard.quotes.length ? <div className="admin-list">{dashboard.quotes.map((quote) => <QuoteEditor key={quote.id} quote={quote} onSaved={() => void load()} />)}</div> : <p>No Couture requests yet.</p>}</section>
    <section className="admin-panel"><div className="admin-panel-heading"><div><p className="workspace-kicker">Orders</p><h2>Recent purchases</h2></div></div>{dashboard.purchases.length ? <div className="admin-list">{dashboard.purchases.map((purchase) => <article key={purchase.id} className="admin-row"><div><strong>{weddingProducts.find((product) => product.slug === purchase.productSlug)?.name ?? purchase.productSlug} · {purchase.tier}</strong><p>{purchase.status.replaceAll("_", " ")} · {php(purchase.priceMinor)} · {new Date(purchase.createdAt).toLocaleDateString("en-PH")}</p>{["PAID", "ORDER_CREATED", "REFUNDED"].includes(purchase.status) && <CostEditor purchaseId={purchase.id} costs={dashboard.costs.filter((cost) => cost.purchaseId === purchase.id)} onSaved={() => void load()} />}</div><div className="admin-order-actions">{purchase.jobOrderId ? <><AssignmentEditor orderId={purchase.jobOrderId} selected={dashboard.productionOrders.find((order) => order.id === purchase.jobOrderId)?.assignedDesignerId ?? null} designers={dashboard.designers} onSaved={() => void load()} /><Link href={`/studio?order=${purchase.jobOrderId}`}>Open order</Link></> : <span>{purchase.status === "PAID" ? "Waiting for customer brief" : "Awaiting payment"}</span>}{["PAID", "ORDER_CREATED"].includes(purchase.status) && <RefundConfirmation purchaseId={purchase.id} onSaved={() => void load()} />}</div></article>)}</div> : <p>No purchases yet.</p>}</section>
    {exceptions.length > 0 && <section className="admin-panel"><p className="workspace-kicker">Needs attention</p><h2>Payment exceptions</h2>{exceptions.map((attempt) => <p key={attempt.id}>Purchase {attempt.purchaseId} · {attempt.state}. Check PayMongo before any manual action.</p>)}</section>}
  </AppShell>;
}

function AssignmentEditor({ orderId, selected, designers, onSaved }: { orderId: string; selected: string | null; designers: Designer[]; onSaved: () => void }) {
  const [value, setValue] = useState(selected ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function assign() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/commerce/admin/orders/${orderId}/assignment`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ designerId: value || null }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not assign designer");
      setMessage("Assignment saved"); onSaved();
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Could not assign designer"); }
    finally { setBusy(false); }
  }
  return <div className="admin-assignment"><label>Designer<select value={value} onChange={(event) => setValue(event.target.value)}><option value="">Unassigned</option>{designers.map((designer) => <option key={designer.id} value={designer.id}>{designer.name}</option>)}</select></label><button type="button" className="workspace-button secondary" disabled={busy || value === (selected ?? "")} onClick={() => void assign()}>Assign</button>{message && <span role="status">{message}</span>}</div>;
}

function RefundConfirmation({ purchaseId, onSaved }: { purchaseId: string; onSaved: () => void }) {
  const [refundId, setRefundId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function confirm() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/commerce/admin/purchases/${purchaseId}/refund`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refundId: refundId.trim() }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not verify the refund");
      setMessage("Full refund verified and recorded"); onSaved();
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Could not verify the refund"); }
    finally { setBusy(false); }
  }
  return <div className="admin-assignment"><label>PayMongo full refund ID<input value={refundId} onChange={(event) => setRefundId(event.target.value)} placeholder="ref_…" autoComplete="off" /></label><button type="button" className="workspace-button secondary" disabled={busy || !refundId.trim()} onClick={() => void confirm()}>Verify refund</button>{message && <span role="status">{message}</span>}</div>;
}

function CostEditor({ purchaseId, costs, onSaved }: { purchaseId: string; costs: Cost[]; onSaved: () => void }) {
  const [category, setCategory] = useState("LABOR");
  const [minutes, setMinutes] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [correctionId, setCorrectionId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const active = costs.filter((cost) => !cost.voidedAt);
  async function add() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/commerce/admin/purchases/${purchaseId}/costs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, minutes: category === "LABOR" ? Number(minutes) : null, amountMinor: Math.round(Number(amount) * 100), note }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not record work");
      setMinutes(""); setAmount(""); setNote(""); setMessage("Work recorded"); onSaved();
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Could not record work"); }
    finally { setBusy(false); }
  }
  async function correct(costId: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/commerce/admin/purchases/${purchaseId}/costs/${costId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not correct the entry");
      setCorrectionId(null); setReason(""); setMessage("Entry corrected and retained in audit history"); onSaved();
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Could not correct the entry"); }
    finally { setBusy(false); }
  }
  return <details className="admin-costs"><summary>Production time and costs · {active.reduce((total, cost) => total + (cost.minutes ?? 0), 0)} min · {php(active.reduce((total, cost) => total + cost.amountMinor, 0))}</summary><div className="admin-cost-form"><label>Type<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="LABOR">Labor</option><option value="ARTWORK">Artwork</option><option value="PAYMENT_FEE">Payment fee</option><option value="OTHER">Other</option></select></label>{category === "LABOR" && <label>Minutes worked<input type="number" min="1" max="1440" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label>}<label>Actual cost in PHP<input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Work or cost note<input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label><button type="button" className="workspace-button secondary" disabled={busy || !note.trim() || !amount || (category === "LABOR" && !minutes)} onClick={() => void add()}>Record</button></div>{active.map((cost) => <div className="admin-cost-entry" key={cost.id}><span>{cost.category.toLowerCase().replaceAll("_", " ")} · {cost.minutes ? `${cost.minutes} min · ` : ""}{php(cost.amountMinor)} · {cost.note}</span>{correctionId === cost.id ? <div><input aria-label="Reason for correction" placeholder="Reason for correction" value={reason} onChange={(event) => setReason(event.target.value)} /><button type="button" disabled={busy || reason.trim().length < 5} onClick={() => void correct(cost.id)}>Confirm correction</button><button type="button" onClick={() => { setCorrectionId(null); setReason(""); }}>Keep entry</button></div> : <button type="button" onClick={() => setCorrectionId(cost.id)}>Correct</button>}</div>)}{message && <p role="status">{message}</p>}</details>;
}

function OfferEditor({ slug, name, tier, offer, onSaved }: { slug: string; name: string; tier: "ESSENTIAL" | "SIGNATURE"; offer?: Offer; onSaved: () => void }) {
  const [price, setPrice] = useState(offer?.priceMinor ? String(offer.priceMinor / 100) : "");
  const [days, setDays] = useState(offer?.turnaroundDays ? String(offer.turnaroundDays) : "");
  const [enabled, setEnabled] = useState(offer?.enabled ?? false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/commerce/admin", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productSlug: slug, tier, priceMinor: price ? Math.round(Number(price) * 100) : null, turnaroundDays: days ? Number(days) : null, enabled }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not save package");
      setMessage("Saved"); onSaved();
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Could not save package"); }
    finally { setBusy(false); }
  }
  return <article className="admin-offer"><p className="workspace-kicker">{name}</p><h3>{tier === "ESSENTIAL" ? "Essential" : "Signature"}</h3><label>Price in PHP<input type="number" min="1" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label><label>Delivery days after completed brief<input type="number" min="1" max="365" value={days} onChange={(event) => setDays(event.target.value)} /></label><label className="admin-switch"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />Available for purchase</label><button className="workspace-button" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save package"}</button>{message && <p role="status">{message}</p>}</article>;
}

function QuoteEditor({ quote, onSaved }: { quote: Quote; onSaved: () => void }) {
  const [scope, setScope] = useState(quote.scope ?? "");
  const [exclusions, setExclusions] = useState(quote.exclusions ?? "");
  const [rounds, setRounds] = useState(quote.revisionRounds ?? 2);
  const [days, setDays] = useState(quote.deliveryDays ?? 21);
  const [price, setPrice] = useState(quote.priceMinor ? String(quote.priceMinor / 100) : "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function offer() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/commerce/quotes/${quote.id}/offer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, exclusions, revisionRounds: rounds, deliveryDays: days, priceMinor: Math.round(Number(price) * 100) }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not offer proposal");
      setMessage("Proposal ready in the customer portal"); onSaved();
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Could not offer proposal"); }
    finally { setBusy(false); }
  }
  return <article className="admin-quote"><div><p className="workspace-kicker">{quote.productSlug.replaceAll("-", " ")} · {quote.state}</p><h3>Requested scope</h3><p>{quote.request}</p></div>{quote.state === "REQUESTED" ? <div className="admin-quote-form"><label>Included work<textarea rows={4} value={scope} onChange={(event) => setScope(event.target.value)} /></label><label>Exclusions<textarea rows={3} value={exclusions} onChange={(event) => setExclusions(event.target.value)} /></label><div className="admin-quote-columns"><label>Revision rounds<input type="number" min="1" max="5" value={rounds} onChange={(event) => setRounds(Number(event.target.value))} /></label><label>Delivery days<input type="number" min="1" max="365" value={days} onChange={(event) => setDays(Number(event.target.value))} /></label><label>Price in PHP<input type="number" min="1" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label></div><button className="workspace-button" disabled={busy} onClick={() => void offer()}>{busy ? "Saving…" : "Offer proposal"}</button>{message && <p role="status">{message}</p>}</div> : <p>{quote.scope}</p>}</article>;
}
