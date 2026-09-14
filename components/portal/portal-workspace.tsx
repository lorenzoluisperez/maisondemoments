"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Clock3, ImagePlus, Plus, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";
import { Progress } from "@/components/ui/progress";
import { CustomerReviewBanner } from "@/components/portal/customer-review-banner";
import { GuestManager } from "@/components/portal/guest-manager";
import type { EventBriefDocument } from "@/lib/content/brief";
import { uploadCustomerImage } from "@/lib/media/browser-upload";

type OrderSummary = { id: string; jobNumber: string; state: string; eventType: EventBriefDocument["event"]["type"] };
type BriefResponse = {
  order: { id: string; jobNumber: string; state: string; collectionKey: string; dueDate: string | null };
  document: EventBriefDocument;
  revision: number;
  submittedAt: string | null;
  completion: { ready: boolean; percent: number; issues: Array<{ section: string; path: string; message: string }> };
};
type SaveState = "saved" | "unsaved" | "saving" | "error" | "conflict";

export function PortalWorkspace() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("identity");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const changeVersion = useRef(0);

  const loadBrief = useCallback(async (orderId: string) => {
    const response = await fetch(`/api/orders/${orderId}/brief`, { credentials: "same-origin", cache: "no-store" });
    const body = await response.json() as { brief?: BriefResponse; error?: string };
    if (!response.ok || !body.brief) throw new Error(body.error ?? "Could not load the event brief");
    setBrief(body.brief);
    setSaveState("saved");
    setMessage(null);
    changeVersion.current = 0;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/orders", { credentials: "same-origin", cache: "no-store" });
        const body = await response.json() as { orders?: OrderSummary[]; error?: string };
        if (!response.ok) throw new Error(response.status === 401 ? "Sign in to open your customer portal" : body.error ?? "Could not load orders");
        const nextOrders = body.orders ?? [];
        setOrders(nextOrders);
        const requestedOrderId = new URLSearchParams(window.location.search).get("order");
        const first = nextOrders.find((order) => order.id === requestedOrderId)?.id ?? nextOrders[0]?.id ?? null;
        setSelectedOrderId(first);
        if (first) await loadBrief(first);
      } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load the portal"); }
    })();
  }, [loadBrief]);

  const persist = useCallback(async (snapshot: BriefResponse, versionAtStart: number) => {
    setSaveState("saving");
    const response = await fetch(`/api/orders/${snapshot.order.id}/brief`, {
      method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: snapshot.revision, document: snapshot.document }),
    });
    const body = await response.json() as { brief?: BriefResponse; error?: string };
    if (response.status === 409) { setSaveState("conflict"); return; }
    if (!response.ok || !body.brief) { setSaveState("error"); setMessage(body.error ?? "Could not save your changes"); return; }
    setBrief((current) => current ? { ...body.brief!, document: changeVersion.current === versionAtStart ? body.brief!.document : current.document } : body.brief!);
    setSaveState(changeVersion.current === versionAtStart ? "saved" : "unsaved");
  }, []);

  useEffect(() => {
    if (!brief || saveState !== "unsaved") return;
    const snapshot = brief;
    const versionAtStart = changeVersion.current;
    const timer = setTimeout(() => void persist(snapshot, versionAtStart), 900);
    return () => clearTimeout(timer);
  }, [brief, persist, saveState]);

  function mutateDocument(updater: (document: EventBriefDocument) => EventBriefDocument) {
    changeVersion.current += 1;
    setBrief((current) => current ? { ...current, document: updater(current.document), submittedAt: null } : current);
    setSaveState("unsaved");
    setMessage(null);
  }
  const replaceEvent = (event: EventBriefDocument["event"]) => mutateDocument((document) => ({ ...document, event }));

  async function submitBrief() {
    if (!brief || saveState !== "saved") return;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/orders/${brief.order.id}/brief/submit`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: brief.revision }) });
      const body = await response.json() as { brief?: BriefResponse; error?: string; issues?: BriefResponse["completion"]["issues"] };
      if (!response.ok || !body.brief) {
        if (body.issues) setBrief((current) => current ? { ...current, completion: { ...current.completion, ready: false, issues: body.issues! } } : current);
        throw new Error(body.error ?? "The brief could not be submitted");
      }
      setBrief(body.brief);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The brief could not be submitted"); }
    finally { setSubmitting(false); }
  }

  async function addPhotos(files: FileList | null) {
    if (!brief || !files?.length) return;
    setUploading(true);
    setMessage(null);
    try {
      for (const file of [...files].slice(0, 12 - brief.document.gallery.length)) {
        const media = await uploadCustomerImage(brief.order.id, file);
        mutateDocument((document) => ({ ...document, gallery: [...document.gallery, { mediaId: media.mediaId, alt: file.name.replace(/\.[^.]+$/, "") || "Event photograph" }] }));
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "The image could not be uploaded"); }
    finally { setUploading(false); }
  }

  if (!brief) return <AppShell area="portal"><section className="empty-workspace"><AlertCircle /><h2>{message ?? "No invitation order yet"}</h2><p>{message?.includes("Sign in") ? "Use the email address attached to your order. We will send a secure sign-in link." : "Your invitation order will appear here after it is created."}</p>{message?.includes("Sign in") ? <Link className="workspace-button" href="/login?returnTo=/portal">Sign in</Link> : null}</section></AppShell>;

  const event = brief.document.event;
  const sections = [
    { id: "identity", label: "Names and date" }, { id: "schedule", label: "Venues and schedule" },
    { id: "participants", label: event.type === "debut" ? "Debut participants" : "People" },
    { id: "wording", label: "Wording and details" }, { id: "photos", label: "Photos" },
  ];
  const issueSections = new Set(brief.completion.issues.map((issue) => issue.section));

  return <AppShell area="portal">
    <header className="workspace-header"><div><p className="workspace-kicker">{brief.order.jobNumber}</p><h1>{eventTitle(event)}</h1></div>{orders.length > 1 ? <select className="workspace-select" value={selectedOrderId ?? ""} onChange={(change) => { if (saveState === "saved") { setSelectedOrderId(change.target.value); void loadBrief(change.target.value); } }}>{orders.map((order) => <option key={order.id} value={order.id}>{order.jobNumber}</option>)}</select> : null}</header>
    <section className="portal-overview"><div><p>Brief completion</p><strong>{brief.completion.percent}%</strong><Progress value={brief.completion.percent} /></div><div><p>Current stage</p><strong>{brief.submittedAt ? "Submitted" : "Content collection"}</strong><span><Clock3 /> {saveLabel(saveState)}</span></div><div><p>Collection</p><strong>{brief.order.collectionKey === "midnight-garden" ? "Midnight Garden" : "Luminous Parchment"}</strong><span><Check /> Facts remain separate from design</span></div></section>
    <CustomerReviewBanner orderId={brief.order.id} />
    {message ? <div className="workspace-alert"><AlertCircle />{message}</div> : null}
    {saveState === "conflict" ? <div className="workspace-alert conflict"><AlertCircle /><span>A newer copy was saved elsewhere.</span><button onClick={() => void loadBrief(brief.order.id)}><RefreshCw /> Reload current copy</button></div> : null}
    <div className="workspace-grid"><aside className="task-list">{sections.map((section, index) => <button key={section.id} className={activeSection === section.id ? "active" : issueSections.has(section.id) ? "" : "complete"} onClick={() => setActiveSection(section.id)}>{issueSections.has(section.id) ? <span>{index + 1}</span> : <Check />} {section.label}</button>)}</aside>
      <section className="workspace-form"><div><p className="workspace-kicker">{sections.find((section) => section.id === activeSection)?.label}</p><h2>{sectionHeading(activeSection)}</h2><p>Your answers save automatically and flow directly into the invitation.</p></div>
        {activeSection === "identity" ? <IdentityFields event={event} onChange={replaceEvent} /> : null}
        {activeSection === "schedule" ? <ScheduleFields event={event} onChange={replaceEvent} /> : null}
        {activeSection === "participants" ? <PeopleFields event={event} onChange={replaceEvent} /> : null}
        {activeSection === "wording" ? <WordingFields event={event} onChange={replaceEvent} /> : null}
        {activeSection === "photos" ? <div className="photo-uploader"><label className="workspace-button secondary"><ImagePlus />{uploading ? "Uploading…" : "Add photos"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={uploading || brief.document.gallery.length >= 12} onChange={(change) => void addPhotos(change.target.files)} /></label><p>{brief.document.gallery.length} of 12 photographs selected</p>{brief.document.gallery.map((photo) => <div key={photo.mediaId}><input value={photo.alt} aria-label="Photo description" onChange={(change) => mutateDocument((document) => ({ ...document, gallery: document.gallery.map((item) => item.mediaId === photo.mediaId ? { ...item, alt: change.target.value } : item) }))} /><button aria-label="Remove photo" onClick={() => mutateDocument((document) => ({ ...document, gallery: document.gallery.filter((item) => item.mediaId !== photo.mediaId) }))}><Trash2 /></button></div>)}</div> : null}
        {brief.completion.issues.some((issue) => issue.section === activeSection) ? <div className="field-issues">{brief.completion.issues.filter((issue) => issue.section === activeSection).map((issue) => <p key={`${issue.path}-${issue.message}`}><AlertCircle />{issue.message}</p>)}</div> : null}
        <div className="form-actions"><span>{saveLabel(saveState)}</span><button className="workspace-button" disabled={!brief.completion.ready || saveState !== "saved" || submitting} onClick={() => void submitBrief()}>{submitting ? "Submitting…" : brief.submittedAt ? "Resubmit updated brief" : "Submit completed brief"}</button></div>
      </section></div><GuestManager orderId={brief.order.id} />
  </AppShell>;
}

function IdentityFields({ event, onChange }: FormProps) {
  const common = <><div className="form-columns"><label>Event date<input type="date" value={event.primaryLocalDate} onChange={(change) => onChange({ ...event, primaryLocalDate: change.target.value })} /></label><label>RSVP deadline<input type="date" value={event.rsvpDeadline} onChange={(change) => onChange({ ...event, rsvpDeadline: change.target.value })} /></label></div><label>Event timezone<input value={event.timezone} onChange={(change) => onChange({ ...event, timezone: change.target.value })} /></label><label>Host wording<input value={event.hostWording} onChange={(change) => onChange({ ...event, hostWording: change.target.value })} /></label></>;
  if (event.type === "wedding") return <>{event.partners.map((person, index) => <div className="form-columns" key={index}><label>{index ? "Second partner" : "First partner"}<input value={person.displayName} onChange={(change) => { const partners = [...event.partners] as typeof event.partners; partners[index] = { ...person, displayName: change.target.value }; onChange({ ...event, partners }); }} /></label><label>Role label<input value={person.roleLabel} onChange={(change) => { const partners = [...event.partners] as typeof event.partners; partners[index] = { ...person, roleLabel: change.target.value }; onChange({ ...event, partners }); }} /></label></div>)}{common}</>;
  if (event.type === "birthday") return <><div className="form-columns"><label>Celebrant<input value={event.celebrant.displayName} onChange={(change) => onChange({ ...event, celebrant: { ...event.celebrant, displayName: change.target.value } })} /></label><label>Displayed age<input type="number" min="1" max="150" value={event.displayedAge ?? ""} onChange={(change) => onChange({ ...event, displayedAge: change.target.value ? Number(change.target.value) : null })} /></label></div>{common}</>;
  if (event.type === "debut") return <><label>Debutante<input value={event.debutante.displayName} onChange={(change) => onChange({ ...event, debutante: { ...event.debutante, displayName: change.target.value } })} /></label>{common}</>;
  return <><label>Child&apos;s name<input value={event.child.displayName} onChange={(change) => onChange({ ...event, child: { ...event.child, displayName: change.target.value } })} /></label>{common}</>;
}

function ScheduleFields({ event, onChange }: FormProps) {
  const update = (index: number, patch: Partial<(typeof event.activities)[number]>) => onChange({ ...event, activities: event.activities.map((activity, itemIndex) => itemIndex === index ? { ...activity, ...patch } : activity) });
  return <div className="repeating-fields">{event.activities.map((activity, index) => <fieldset key={activity.id}><legend>{activity.label || `Activity ${index + 1}`}</legend><div className="form-columns"><label>Label<input value={activity.label} onChange={(change) => update(index, { label: change.target.value })} /></label><label>Type<select value={activity.kind} onChange={(change) => update(index, { kind: change.target.value as typeof activity.kind })}><option value="ceremony">Ceremony</option><option value="reception">Reception</option><option value="program">Program</option><option value="party">Party</option></select></label></div><label>Date and time<input type="datetime-local" value={toLocalDateTime(activity.startsAt, event.timezone)} onChange={(change) => update(index, { startsAt: localDateTimeToIso(change.target.value, event.timezone) })} /></label><label>Venue<input value={activity.venueName} onChange={(change) => update(index, { venueName: change.target.value })} /></label><label>Address<input value={activity.address} onChange={(change) => update(index, { address: change.target.value })} /></label><label>HTTPS map link<input type="url" value={activity.mapUrl} onChange={(change) => update(index, { mapUrl: change.target.value })} /></label>{event.activities.length > 1 ? <button className="reset-button" onClick={() => onChange({ ...event, activities: event.activities.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /> Remove activity</button> : null}</fieldset>)}<button className="workspace-button secondary" disabled={event.activities.length >= 8} onClick={() => onChange({ ...event, activities: [...event.activities, { id: crypto.randomUUID(), kind: "reception", label: "", startsAt: "", venueName: "", address: "", mapUrl: "" }] })}><Plus /> Add activity</button></div>;
}

function PeopleFields({ event, onChange }: FormProps) {
  if (event.type === "christening") return <div className="repeating-fields"><fieldset><legend>Parents or guardians</legend><PersonRows rows={event.parentsOrGuardians} maximum={4} onChange={(parentsOrGuardians) => onChange({ ...event, parentsOrGuardians })} /></fieldset><fieldset><legend>Godparents and participants</legend><PersonRows rows={event.participants} maximum={120} onChange={(participants) => onChange({ ...event, participants })} /></fieldset></div>;
  return <PersonRows rows={event.participants} maximum={120} onChange={(participants) => onChange({ ...event, participants })} />;
}

function PersonRows({ rows, maximum, onChange }: { rows: Array<{ roleLabel: string; displayName: string }>; maximum: number; onChange: (rows: Array<{ roleLabel: string; displayName: string }>) => void }) {
  return <div className="repeating-fields">{rows.map((person, index) => <div className="person-row" key={index}><input aria-label="Role" value={person.roleLabel} placeholder="Role" onChange={(change) => onChange(rows.map((item, itemIndex) => itemIndex === index ? { ...item, roleLabel: change.target.value } : item))} /><input aria-label="Name" value={person.displayName} placeholder="Display name" onChange={(change) => onChange(rows.map((item, itemIndex) => itemIndex === index ? { ...item, displayName: change.target.value } : item))} /><button aria-label="Remove person" onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button></div>)}<button className="workspace-button secondary" disabled={rows.length >= maximum} onClick={() => onChange([...rows, { roleLabel: "", displayName: "" }])}><Plus /> Add person</button></div>;
}

function WordingFields({ event, onChange }: FormProps) { return <><label>Story<textarea rows={5} value={event.story} onChange={(change) => onChange({ ...event, story: change.target.value })} /></label><label>Dress code<textarea rows={3} value={event.dressCode} onChange={(change) => onChange({ ...event, dressCode: change.target.value })} /></label><label>Gift information<textarea rows={3} value={event.giftInformation} onChange={(change) => onChange({ ...event, giftInformation: change.target.value })} /></label></>; }

type FormProps = { event: EventBriefDocument["event"]; onChange: (event: EventBriefDocument["event"]) => void };
function eventTitle(event: EventBriefDocument["event"]) { if (event.type === "wedding") return `${event.partners[0].displayName} & ${event.partners[1].displayName}`; if (event.type === "birthday") return event.celebrant.displayName; if (event.type === "debut") return event.debutante.displayName; return event.child.displayName; }
function sectionHeading(section: string) { if (section === "identity") return "Names and date"; if (section === "schedule") return "Venues and schedule"; if (section === "participants") return "People in the celebration"; if (section === "wording") return "The finishing details"; return "Your photographs"; }
function saveLabel(state: SaveState) { return state === "saving" ? "Saving changes…" : state === "unsaved" ? "Changes waiting to save" : state === "conflict" ? "Save conflict" : state === "error" ? "Save failed" : "All changes saved"; }

function toLocalDateTime(value: string, timeZone: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
  } catch { return value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)?.[0] ?? ""; }
}

function localDateTimeToIso(value: string, timeZone: string) {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return value;
  const desiredUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  try {
    let instant = desiredUtc;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
      const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value ?? 0);
      const representedUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
      instant += desiredUtc - representedUtc;
    }
    return new Date(instant).toISOString();
  } catch { return `${value}:00Z`; }
}
