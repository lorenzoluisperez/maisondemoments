"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clipboard, Download, Link2, Plus, RefreshCw, Save, Trash2, Upload } from "lucide-react";

type Slot = { id?: string; type: "ADULT" | "CHILD"; assignedName: string | null; isAdditionalGuest: boolean; displayOrder?: number };
type Household = { id: string; label: string; active: boolean; revision: number; slots: Slot[]; link: { url: string; generation: number; expiresAt: string } | null; response: { status: "ATTENDING" | "DECLINED"; revision: number; note: string | null; attendees: Array<{ slotId: string; displayName: string | null }> } | null };
type GuestList = { invitation: { id: string; slug: string; availability: string; expiresAt: string } | null; households: Household[]; totals: { households: number; allocatedSeats: number; attendingHouseholds: number; attendingGuests: number; declinedHouseholds: number }; permissions: { canCorrect: boolean } };

export function GuestManager({ orderId }: { orderId: string }) {
  const [data, setData] = useState<GuestList | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [newHousehold, setNewHousehold] = useState({ label: "", adultSeats: 2, childSeats: 0, additionalGuests: 0 });
  const [csv, setCsv] = useState("household,adults,children,additional_guests\n");
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/orders/${orderId}/guests`, { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        const body = await response.json() as GuestList & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Guest list could not be loaded");
        if (!cancelled) setData(body);
      })
      .catch((error) => { if (!cancelled) setMessage(error instanceof Error ? error.message : "Guest list could not be loaded"); });
    return () => { cancelled = true; };
  }, [orderId]);

  async function mutate(path: string, method: "POST" | "PATCH", body: unknown) {
    setWorking(true); setMessage(null);
    try {
      const response = await fetch(`/api/orders/${orderId}/guests${path}`, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as GuestList & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Guest list change failed");
      setData(result);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Guest list change failed"); }
    finally { setWorking(false); }
  }

  if (!data) return <section className="guest-manager"><p>{message ?? "Loading household invitations…"}</p></section>;
  if (!data.invitation) return <section className="guest-manager"><header><div><p className="workspace-kicker">Guests and RSVP</p><h2>Household invitations</h2></div></header><p>Submit the completed customer brief to generate the invitation before adding households.</p></section>;
  const slots = [
    ...Array.from({ length: newHousehold.adultSeats }, () => ({ type: "ADULT" as const, assignedName: null, isAdditionalGuest: false })),
    ...Array.from({ length: newHousehold.childSeats }, () => ({ type: "CHILD" as const, assignedName: null, isAdditionalGuest: false })),
    ...Array.from({ length: newHousehold.additionalGuests }, () => ({ type: "ADULT" as const, assignedName: null, isAdditionalGuest: true })),
  ];
  return <section className="guest-manager"><header><div><p className="workspace-kicker">Guests and RSVP</p><h2>Household invitations</h2></div><a className="workspace-button secondary" href={`/api/orders/${orderId}/guests/export`}><Download /> Export responses</a></header>
    {message ? <div className="workspace-alert"><AlertCircle />{message}</div> : null}
    <div className="guest-totals"><div><span>Households</span><strong>{data.totals.households}</strong></div><div><span>Allocated seats</span><strong>{data.totals.allocatedSeats}</strong></div><div><span>Attending</span><strong>{data.totals.attendingGuests}</strong></div><div><span>Declined</span><strong>{data.totals.declinedHouseholds}</strong></div></div>
    <div className="guest-entry-grid"><form onSubmit={(event) => { event.preventDefault(); void mutate("", "POST", { label: newHousehold.label, slots }); }}><h3>Add one household</h3><label>Household label<input required maxLength={160} value={newHousehold.label} onChange={(event) => setNewHousehold({ ...newHousehold, label: event.target.value })} placeholder="The Santos family" /></label><div className="form-columns"><label>Adult seats<input type="number" min="0" max="20" value={newHousehold.adultSeats} onChange={(event) => setNewHousehold({ ...newHousehold, adultSeats: Number(event.target.value) })} /></label><label>Child seats<input type="number" min="0" max="20" value={newHousehold.childSeats} onChange={(event) => setNewHousehold({ ...newHousehold, childSeats: Number(event.target.value) })} /></label></div><label>Additional adult guests<input type="number" min="0" max="10" value={newHousehold.additionalGuests} onChange={(event) => setNewHousehold({ ...newHousehold, additionalGuests: Number(event.target.value) })} /></label><button className="workspace-button" disabled={working || !slots.length}><Plus /> Add household</button></form>
      <div><h3>Import CSV</h3><p>Use semicolons between names. Header: household, adults, children, additional_guests.</p><textarea rows={7} value={csv} onChange={(event) => setCsv(event.target.value)} /><button className="workspace-button secondary" disabled={working} onClick={() => void mutate("/import", "POST", { csv })}><Upload /> Import households</button></div></div>
    <div className="household-list">{data.households.map((household) => <HouseholdCard key={`${household.id}-${household.revision}`} household={household} working={working} canCorrect={data.permissions.canCorrect} onMutate={mutate} />)}</div>
  </section>;
}

function HouseholdCard({ household, working, canCorrect, onMutate }: { household: Household; working: boolean; canCorrect: boolean; onMutate: (path: string, method: "POST" | "PATCH", body: unknown) => Promise<void> }) {
  const [label, setLabel] = useState(household.label);
  const [slots, setSlots] = useState(household.slots);
  const reason = (action: string) => window.prompt(`Reason to ${action} this household link:`)?.trim();
  return <article className="household-card"><header><div><input aria-label="Household label" value={label} onChange={(event) => setLabel(event.target.value)} /><span className={household.active ? "active" : "inactive"}>{household.active ? "Active" : "Inactive"}</span></div><strong>{household.response ? household.response.status.replaceAll("_", " ") : "NO RESPONSE"}</strong></header>
    <div className="slot-editor">{slots.map((slot, index) => <div key={slot.id ?? index}><select value={slot.type} onChange={(event) => setSlots((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as Slot["type"] } : item))}><option value="ADULT">Adult</option><option value="CHILD">Child</option></select><input aria-label={`Seat ${index + 1} name`} value={slot.assignedName ?? ""} placeholder={slot.isAdditionalGuest ? "Additional guest" : "Assigned name (optional)"} onChange={(event) => setSlots((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, assignedName: event.target.value || null } : item))} /><label><input type="checkbox" checked={slot.isAdditionalGuest} onChange={(event) => setSlots((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, isAdditionalGuest: event.target.checked } : item))} />Additional</label><button aria-label={`Remove seat ${index + 1}`} onClick={() => setSlots((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button></div>)}</div>
    <div className="household-actions"><button onClick={() => setSlots((current) => [...current, { type: "ADULT", assignedName: null, isAdditionalGuest: false }])} disabled={working || slots.length >= 20}><Plus /> Seat</button><button onClick={() => void onMutate(`/${household.id}`, "PATCH", householdUpdate(label, slots, household.active, household.revision))} disabled={working || !slots.length}><Save /> Save</button><button onClick={() => void onMutate(`/${household.id}`, "PATCH", householdUpdate(label, slots, !household.active, household.revision))} disabled={working}>{household.active ? "Deactivate" : "Reactivate"}</button>{household.link ? <><button onClick={() => void navigator.clipboard.writeText(household.link!.url)}><Clipboard /> Copy link</button><button onClick={() => { const value = reason("rotate"); if (value) void onMutate(`/${household.id}/rotate`, "POST", { reason: value }); }}><RefreshCw /> Rotate</button><button onClick={() => { const value = reason("revoke"); if (value) void onMutate(`/${household.id}/revoke`, "POST", { reason: value }); }}><Trash2 /> Revoke</button></> : <button onClick={() => { const value = reason("issue"); if (value) void onMutate(`/${household.id}/rotate`, "POST", { reason: value }); }}><Link2 /> Issue link</button>}</div>
    {household.response ? <div className="household-response"><CheckCircle2 /><span>{household.response.attendees.length} attending · revision {household.response.revision}{household.response.note ? ` · ${household.response.note}` : ""}</span>{canCorrect ? <button onClick={() => { const value = reason("correct"); if (value) void onMutate(`/${household.id}/correction`, "POST", { status: "DECLINED", selectedSlotIds: [], attendeeNames: {}, reason: value }); }}>Mark declined</button> : null}</div> : null}
  </article>;
}

function householdUpdate(label: string, slots: Slot[], active: boolean, expectedRevision: number) {
  return { label, active, expectedRevision, slots: slots.map(({ id, type, assignedName, isAdditionalGuest }) => ({ id, type, assignedName, isAdditionalGuest })) };
}
