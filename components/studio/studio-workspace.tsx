"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Layers3, Redo2, RefreshCw, RotateCcw, Search, SlidersHorizontal, Undo2 } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReviewPublishingPanel } from "@/components/studio/review-publishing-panel";
import type { InvitationConfig } from "@/lib/invitation/config";
import { originalProductPresentation } from "@/lib/products/presentation";

type StudioOrder = { id: string; jobNumber: string; customerName: string; state: string; eventType: string; dueDate: string | null; invitationId: string | null; draftRevision: number | null };
type StudioData = {
  order: { id: string; jobNumber: string; eventType: string; collectionKey: string; state: string; dueDate: string | null; productSlug: string | null; tier: string | null };
  draft: { invitationId: string; revision: number; reviewState: string; configuration: InvitationConfig; updatedAt: string };
  snapshot: { title: string; secondaryName?: string; hostWording: string; dateLabel: string };
};
type SaveState = "saved" | "unsaved" | "saving" | "conflict" | "error";

export function StudioWorkspace({ initialOrderId }: { initialOrderId?: string }) {
  const [orders, setOrders] = useState<StudioOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<StudioData | null>(null);
  const [configuration, setConfiguration] = useState<InvitationConfig | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState("opening");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState<string | null>(null);
  const [fitWarnings, setFitWarnings] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [previewWidth, setPreviewWidth] = useState(390);
  const [previewEditing, setPreviewEditing] = useState(true);
  const [dueSoonCutoff] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const history = useRef<InvitationConfig[]>([]);
  const future = useRef<InvitationConfig[]>([]);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const changeVersion = useRef(0);

  const loadWorkspace = useCallback(async (orderId: string) => {
    const response = await fetch(`/api/studio/orders/${orderId}`, { credentials: "same-origin", cache: "no-store" });
    const body = await response.json() as { workspace?: StudioData; error?: string };
    if (!response.ok || !body.workspace) throw new Error(body.error ?? "Could not open the studio draft");
    setWorkspace(body.workspace);
    setConfiguration(body.workspace.draft.configuration);
    setSelectedSceneId(body.workspace.draft.configuration.scenes[0].id);
    setSaveState("saved");
    setMessage(null);
    history.current = [];
    future.current = [];
    changeVersion.current = 0;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/studio/orders", { credentials: "same-origin", cache: "no-store" });
        const body = await response.json() as { orders?: StudioOrder[]; error?: string };
        if (!response.ok) throw new Error(response.status === 401 ? "Sign in with a staff account to open the studio" : body.error ?? "Could not load production orders");
        const nextOrders = body.orders ?? [];
        setOrders(nextOrders);
        const first = nextOrders.find((order) => order.id === initialOrderId && order.invitationId)?.id
          ?? nextOrders.find((order) => order.invitationId)?.id ?? null;
        setSelectedId(first);
        if (first) await loadWorkspace(first);
      } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load the studio"); }
    })();
  }, [initialOrderId, loadWorkspace]);

  const persist = useCallback(async (snapshot: StudioData, config: InvitationConfig, versionAtStart: number) => {
    setSaveState("saving");
    const response = await fetch(`/api/studio/orders/${snapshot.order.id}`, {
      method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot.order.productSlug ? {
        expectedRevision: snapshot.draft.revision,
        productPresentation: config.productPresentation ?? originalProductPresentation,
      } : {
        expectedRevision: snapshot.draft.revision,
        typography: config.typography,
        animationIntensity: config.animationIntensity,
        scenes: config.scenes.map((item) => ({ id: item.id, layoutVariant: item.layoutVariant, ...(item.assets[0] ? { asset: { id: item.assets[0].id, x: item.assets[0].x, y: item.assets[0].y, scale: item.assets[0].scale, rotation: item.assets[0].rotation, zIndex: item.assets[0].zIndex, hidden: item.assets[0].hidden } } : {}) })),
      }),
    });
    const body = await response.json() as { workspace?: StudioData; error?: string };
    if (response.status === 409) { setSaveState("conflict"); return; }
    if (!response.ok || !body.workspace) { setSaveState("error"); setMessage(body.error ?? "Could not save the composition"); return; }
    setWorkspace(body.workspace);
    if (changeVersion.current === versionAtStart) { setConfiguration(body.workspace.draft.configuration); setSaveState("saved"); }
    else setSaveState("unsaved");
  }, []);

  useEffect(() => {
    if (!workspace || !configuration || saveState !== "unsaved") return;
    const versionAtStart = changeVersion.current;
    const timer = setTimeout(() => void persist(workspace, configuration, versionAtStart), 700);
    return () => clearTimeout(timer);
  }, [configuration, persist, saveState, workspace]);

  const inspectPreviewFit = useCallback(async () => {
    if (!workspace?.order.productSlug) return;
    const frame = previewRef.current;
    const previewWindow = frame?.contentWindow;
    const document = previewWindow?.document;
    if (!previewWindow || !document || !document.querySelector("main")) return;
    await document.fonts.ready;
    const warnings = new Set<string>();
    for (const element of document.querySelectorAll<HTMLElement>("[data-fit-critical]")) {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (rect.left < -2 || rect.right > previewWindow.innerWidth + 2 || element.scrollWidth > element.clientWidth + 2) {
        warnings.add(`${element.dataset.fitCritical === "venue" ? "Venue" : "Name"} text overflows at ${previewWindow.innerWidth}px. Try compact fit or a shorter approved display label.`);
      }
    }
    setFitWarnings([...warnings]);
  }, [workspace?.order.productSlug]);

  useEffect(() => {
    if (!workspace?.order.productSlug) return;
    const timer = window.setTimeout(() => void inspectPreviewFit(), 600);
    return () => window.clearTimeout(timer);
  }, [inspectPreviewFit, previewWidth, workspace?.draft.revision, workspace?.order.productSlug]);

  function mutate(mutator: (current: InvitationConfig) => InvitationConfig) {
    if (!configuration) return;
    history.current.push(configuration);
    if (history.current.length > 50) history.current.shift();
    future.current = [];
    setConfiguration(mutator(configuration));
    changeVersion.current += 1;
    setSaveState("unsaved");
    setMessage(null);
  }

  function restore(direction: "undo" | "redo") {
    if (!configuration) return;
    const source = direction === "undo" ? history.current : future.current;
    const destination = direction === "undo" ? future.current : history.current;
    const next = source.pop();
    if (!next) return;
    destination.push(configuration);
    setConfiguration(next);
    changeVersion.current += 1;
    setSaveState("unsaved");
  }

  const visibleOrders = useMemo(() => orders.filter((order) => `${order.jobNumber} ${order.customerName}`.toLowerCase().includes(search.toLowerCase())), [orders, search]);
  const selectedScene = configuration?.scenes.find((scene) => scene.id === selectedSceneId);
  const productSections = workspace?.order.productSlug === "garden-romance"
    ? ["opening", "bookshop", "proposal", "venue", "celebration", "entourage", "program", "rsvp"]
    : ["reveal", "story", "celebration", "entourage", "program", "rsvp"];
  const selectedAsset = selectedScene?.assets[0];
  const selectedOrder = orders.find((order) => order.id === selectedId);
  const queue = { ready: orders.filter((order) => order.state === "READY").length, design: orders.filter((order) => order.state === "IN_PRODUCTION").length, waiting: orders.filter((order) => !order.invitationId).length, due: orders.filter((order) => order.dueDate && order.dueDate <= dueSoonCutoff).length };

  if (!workspace || !configuration) return <AppShell area="studio"><header className="workspace-header"><div><p className="workspace-kicker">Production studio</p><h1>Today&apos;s work</h1></div></header><section className="empty-workspace"><AlertCircle /><h2>{message ?? "No submitted drafts are ready"}</h2><p>Orders appear here after the customer submits a complete brief and the automatic draft is generated.</p>{message?.includes("Sign in") ? <Link className="workspace-button" href="/login?returnTo=/studio">Staff sign in</Link> : null}</section></AppShell>;

  const updateScene = (patch: Partial<(typeof configuration.scenes)[number]>) => mutate((current) => ({ ...current, scenes: current.scenes.map((scene) => scene.id === selectedSceneId ? { ...scene, ...patch } : scene) }));
  const updateAsset = (patch: Partial<NonNullable<typeof selectedAsset>>) => updateScene({ assets: selectedScene!.assets.map((asset, index) => index === 0 ? { ...asset, ...patch } : asset) });

  return <AppShell area="studio">
    <header className="workspace-header"><div><p className="workspace-kicker">Production studio</p><h1>Today&apos;s work</h1></div><div className="search-box"><Search /><input aria-label="Search jobs" placeholder="Search JO or customer" value={search} onChange={(change) => setSearch(change.target.value)} /></div></header>
    <section className="queue-summary"><div><span>Ready to start</span><strong>{queue.ready}</strong></div><div><span>In design</span><strong>{queue.design}</strong></div><div><span>Waiting for brief</span><strong>{queue.waiting}</strong></div><div><span>Due this week</span><strong>{queue.due}</strong></div></section>
    <div className="job-table"><Table><TableHeader><TableRow><TableHead>Job order</TableHead><TableHead>Customer</TableHead><TableHead>Event</TableHead><TableHead>Stage</TableHead><TableHead>Due</TableHead></TableRow></TableHeader><TableBody>{visibleOrders.map((order) => <TableRow key={order.id} data-selected={selectedId === order.id} onClick={() => { if (order.invitationId && saveState === "saved") { setSelectedId(order.id); void loadWorkspace(order.id); } }}><TableCell><strong>{order.jobNumber}</strong></TableCell><TableCell>{order.customerName}</TableCell><TableCell className="capitalize">{order.eventType}</TableCell><TableCell>{order.invitationId ? order.state.replaceAll("_", " ") : "Waiting for brief"}</TableCell><TableCell>{order.dueDate ?? "Not set"}</TableCell></TableRow>)}</TableBody></Table></div>
    {message ? <div className="workspace-alert"><AlertCircle />{message}</div> : null}
    {saveState === "conflict" ? <div className="workspace-alert conflict"><AlertCircle /><span>A newer studio revision exists.</span><button onClick={() => void loadWorkspace(workspace.order.id)}><RefreshCw /> Load current revision</button></div> : null}
    <section className="studio-editor"><div className="editor-toolbar"><div><p className="workspace-kicker">{workspace.order.jobNumber}</p><h2>{selectedOrder?.customerName}</h2></div><div><button className="icon-button" aria-label="Undo" disabled={saveState === "saving" || workspace.draft.reviewState === "IN_REVIEW" || workspace.draft.reviewState === "APPROVED"} onClick={() => restore("undo")}><Undo2 /></button><button className="icon-button" aria-label="Redo" disabled={saveState === "saving" || workspace.draft.reviewState === "IN_REVIEW" || workspace.draft.reviewState === "APPROVED"} onClick={() => restore("redo")}><Redo2 /></button><span className={saveState === "saved" ? "save-state saved" : "save-state"}>{saveState === "saved" ? <CheckCircle2 /> : <RefreshCw />}{saveStateLabel(saveState)} · r{workspace.draft.revision}</span></div></div>
      <div className="editor-grid"><aside className="scene-list"><h3>Scenes</h3>{workspace.order.productSlug ? productSections.map((id, index) => <button className={id === selectedSceneId ? "active" : ""} key={id} onClick={() => { setSelectedSceneId(id); previewRef.current?.contentWindow?.document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); }}><span>{index + 1}</span>{id === "bookshop" || id === "proposal" || id === "venue" ? "Story" : id.replace(/^./, (letter) => letter.toUpperCase())}<Layers3 /></button>) : configuration.scenes.map((scene, index) => <button className={scene.id === selectedSceneId ? "active" : ""} key={scene.id} onClick={() => setSelectedSceneId(scene.id)}><span>{index + 1}</span>{scene.label}<Layers3 /></button>)}</aside>
        <div className="editor-canvas"><div className="preview-toolbar"><button onClick={() => setPreviewWidth(390)} className={previewWidth === 390 ? "active" : ""}>Phone</button><button onClick={() => setPreviewWidth(768)} className={previewWidth === 768 ? "active" : ""}>Tablet</button><button onClick={() => setPreviewWidth(1200)} className={previewWidth === 1200 ? "active" : ""}>Desktop</button><label className="preview-width">Width <input aria-label="Preview width in pixels" type="number" min="320" max="1440" value={previewWidth} onChange={(event) => setPreviewWidth(Math.max(320, Math.min(1440, Number(event.target.value) || 320)))} />px</label><button className={previewEditing ? "active" : ""} onClick={() => setPreviewEditing(true)}>Edit view</button><button onClick={() => setPreviewEditing(false)}>Replay opening</button><Link href={`/studio/orders/${workspace.order.id}/preview`} target="_blank"><Eye /> Open preview</Link></div>{fitWarnings.length > 0 && <div className="workspace-alert" role="alert">{fitWarnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}<iframe ref={previewRef} onLoad={() => void inspectPreviewFit()} key={`${workspace.draft.revision}:${previewEditing}`} className="studio-preview" style={{ width: previewWidth }} title="Invitation draft preview" src={`/studio/orders/${workspace.order.id}/preview${previewEditing ? "?editing=1" : ""}`} /></div>
        <aside className="property-panel">{workspace.order.productSlug ? <fieldset disabled={workspace.draft.reviewState === "IN_REVIEW" || workspace.draft.reviewState === "APPROVED"}><div className="panel-title"><SlidersHorizontal /><h3>Design options</h3></div><p>{workspace.order.tier === "ESSENTIAL" ? "Essential keeps the original styling. A compact fit is available when names or venue labels need more room." : "Curated accent colors and quiet ornaments preserve this design’s original artwork."}</p><label>Name and venue fit<select value={configuration.productPresentation?.fit ?? "standard"} onChange={(change) => mutate((current) => ({ ...current, productPresentation: { ...(current.productPresentation ?? originalProductPresentation), fit: change.target.value as "standard" | "compact" } }))}><option value="standard">Standard</option><option value="compact">Compact</option></select></label><label>Accent palette<select disabled={workspace.order.tier === "ESSENTIAL"} value={configuration.productPresentation?.palette ?? "original"} onChange={(change) => mutate((current) => ({ ...current, productPresentation: { ...(current.productPresentation ?? originalProductPresentation), palette: change.target.value as "original" | "soft" | "deep" } }))}><option value="original">Original</option><option value="soft">Soft</option><option value="deep">Deep</option></select></label><label>Decorative accents<select disabled={workspace.order.tier === "ESSENTIAL"} value={configuration.productPresentation?.ornaments ?? "original"} onChange={(change) => mutate((current) => ({ ...current, productPresentation: { ...(current.productPresentation ?? originalProductPresentation), ornaments: change.target.value as "original" | "quiet" } }))}><option value="original">Original</option><option value="quiet">Quiet</option></select></label></fieldset> : <fieldset disabled={workspace.draft.reviewState === "IN_REVIEW" || workspace.draft.reviewState === "APPROVED"}><div className="panel-title"><SlidersHorizontal /><h3>{selectedScene?.label}</h3></div><label>Typography<select value={configuration.typography} onChange={(change) => mutate((current) => ({ ...current, typography: change.target.value as InvitationConfig["typography"] }))}><option value="romantic-serif">Romantic serif</option><option value="editorial-serif">Editorial serif</option></select></label><label>Motion<select value={configuration.animationIntensity} onChange={(change) => mutate((current) => ({ ...current, animationIntensity: change.target.value as InvitationConfig["animationIntensity"] }))}><option value="subtle">Subtle</option><option value="standard">Standard</option><option value="cinematic">Cinematic</option></select></label><label>Layout<select value={selectedScene?.layoutVariant} onChange={(change) => updateScene({ layoutVariant: change.target.value as NonNullable<typeof selectedScene>["layoutVariant"] })}><option value="centered">Centered</option><option value="cards">Cards</option><option value="columns">Columns</option><option value="editorial">Editorial</option></select></label>
          {selectedAsset ? <><label>Scale <output>{Math.round(selectedAsset.scale * 100)}%</output><input type="range" min="10" max="300" value={selectedAsset.scale * 100} onChange={(change) => updateAsset({ scale: Number(change.target.value) / 100 })} /></label><label>Rotation <output>{selectedAsset.rotation}°</output><input type="range" min="-180" max="180" value={selectedAsset.rotation} onChange={(change) => updateAsset({ rotation: Number(change.target.value) })} /></label><div className="form-columns"><label>X position<input type="number" min="-30" max="130" value={selectedAsset.x} onChange={(change) => updateAsset({ x: Number(change.target.value) })} /></label><label>Y position<input type="number" min="-30" max="130" value={selectedAsset.y} onChange={(change) => updateAsset({ y: Number(change.target.value) })} /></label></div><label>Layer<input type="number" min="-10" max="20" value={selectedAsset.zIndex} onChange={(change) => updateAsset({ zIndex: Number(change.target.value) })} /></label><button className="reset-button" onClick={() => updateAsset({ x: 50, y: 50, scale: 1, rotation: 0, zIndex: 0, hidden: false })}><RotateCcw /> Reset this asset</button><button className="reset-button" onClick={() => updateAsset({ hidden: !selectedAsset.hidden })}>{selectedAsset.hidden ? <Eye /> : <EyeOff />} {selectedAsset.hidden ? "Show artwork" : "Hide artwork"}</button></> : null}
        </fieldset>}</aside></div><ReviewPublishingPanel orderId={workspace.order.id} revision={workspace.draft.revision} reviewState={workspace.draft.reviewState} saveState={saveState} productSlug={workspace.order.productSlug} fitWarnings={fitWarnings} onRefresh={() => loadWorkspace(workspace.order.id)} /></section>
  </AppShell>;
}

function saveStateLabel(state: SaveState) { return state === "saved" ? "Saved" : state === "saving" ? "Saving" : state === "conflict" ? "Conflict" : state === "error" ? "Save failed" : "Unsaved"; }
