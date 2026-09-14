"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, LockKeyhole } from "lucide-react";
import { TheatricalInvitation } from "@/components/invitation/theatrical-invitation";
import type { InvitationRenderModel } from "@/lib/media/types";

type Slot = { id: string; type: "ADULT" | "CHILD"; assignedName: string | null; isAdditionalGuest: boolean; displayOrder: number };
type GuestData = {
  invitation: { version: number; rsvpDeadline: string; timezone: string };
  household: { id: string; label: string; slots: Slot[] };
  response: { status: "ATTENDING" | "DECLINED"; revision: number; note: string | null; attendees: Array<{ slotId: string; displayName: string | null }> } | null;
  rsvpOpen: boolean;
  snapshot: InvitationRenderModel;
};

export function PrivateInvitation({ slug }: { slug: string }) {
  const [data, setData] = useState<GuestData | null>(null);
  const [message, setMessage] = useState("Opening your private invitation…");
  const load = useCallback(async () => {
    const response = await fetch(`/api/guest/invitations/${slug}`, { cache: "no-store", credentials: "same-origin" });
    const body = await response.json() as GuestData & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "Use the private household link sent by your host.");
    setData(body);
  }, [slug]);
  useEffect(() => { void (async () => {
    try {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("invite");
      if (token) {
        const response = await fetch("/api/guest/session/exchange", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, token, website: "" }) });
        const body = await response.json() as { error?: string };
        if (!response.ok) throw new Error(body.error ?? "This invitation link is unavailable.");
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "This invitation is unavailable."); }
  })(); }, [load, slug]);
  if (!data) return <main className="private-invitation-gate"><LockKeyhole /><p className="eyebrow">Maison de Moments</p><h1>{message}</h1><p>Household links may be revoked or reissued by the host.</p></main>;
  return <TheatricalInvitation snapshot={data.snapshot} rsvpContent={<HouseholdRsvp slug={slug} data={data} onSaved={setData} />} />;
}

function HouseholdRsvp({ slug, data, onSaved }: { slug: string; data: GuestData; onSaved: (data: GuestData) => void }) {
  const currentIds = data.response?.attendees.map((item) => item.slotId) ?? [];
  const [status, setStatus] = useState<"ATTENDING" | "DECLINED">(data.response?.status ?? "ATTENDING");
  const [selected, setSelected] = useState<string[]>(currentIds);
  const [names, setNames] = useState<Record<string, string>>(Object.fromEntries(data.response?.attendees.map((item) => [item.slotId, item.displayName ?? ""]) ?? []));
  const [note, setNote] = useState(data.response?.note ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  async function submit() {
    setSaving(true); setMessage(null);
    try {
      const response = await fetch(`/api/guest/invitations/${slug}/rsvp`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        status, selectedSlotIds: status === "ATTENDING" ? selected : [], attendeeNames: status === "ATTENDING" ? names : {}, note, expectedRevision: data.response?.revision ?? 0,
        invitationVersion: data.invitation.version, idempotencyKey: idempotencyKey.current, website: "",
      }) });
      const body = await response.json() as GuestData & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Your response could not be saved");
      idempotencyKey.current = crypto.randomUUID(); onSaved(body); setMessage("Your response is saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Your response could not be saved"); }
    finally { setSaving(false); }
  }
  return <div className="household-rsvp" data-reveal><p className="household-note">{data.household.label} · {data.household.slots.length} {data.household.slots.length === 1 ? "seat" : "seats"} reserved</p>
    {data.response ? <p className="rsvp-current"><CheckCircle2 /> Current response: {data.response.status === "ATTENDING" ? `${data.response.attendees.length} attending` : "Declined"}</p> : null}
    {data.rsvpOpen ? <><div className="rsvp-options"><button className={status === "ATTENDING" ? "primary-action" : "secondary-action"} onClick={() => setStatus("ATTENDING")}>Joyfully accepts</button><button className={status === "DECLINED" ? "primary-action" : "secondary-action"} onClick={() => { setStatus("DECLINED"); setSelected([]); }}>Regretfully declines</button></div>
      {status === "ATTENDING" ? <div className="seat-selector">{data.household.slots.map((slot) => <label key={slot.id}><input type="checkbox" checked={selected.includes(slot.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, slot.id] : current.filter((id) => id !== slot.id))} /><span><strong>{slot.assignedName ?? (slot.isAdditionalGuest ? "Additional guest" : `${slot.type === "CHILD" ? "Child" : "Guest"} ${slot.displayOrder + 1}`)}</strong><small>{slot.type === "CHILD" ? "Child seat" : "Adult seat"}</small></span>{!slot.assignedName && selected.includes(slot.id) ? <input aria-label={`Name for seat ${slot.displayOrder + 1}`} value={names[slot.id] ?? ""} required={slot.type === "ADULT"} placeholder={slot.type === "CHILD" ? "Name (optional)" : "Guest name"} onChange={(event) => setNames({ ...names, [slot.id]: event.target.value })} /> : null}</label>)}</div> : null}
      <label className="rsvp-note">Private note to the host<textarea rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label><button className="primary-action" disabled={saving || (status === "ATTENDING" && selected.length === 0)} onClick={() => void submit()}>{saving ? "Saving…" : data.response ? "Update response" : "Send response"}</button></> : <p className="rsvp-closed"><AlertCircle /> The RSVP deadline has passed. Contact the host for a correction.</p>}
    {message ? <p className="rsvp-message" role="status">{message}</p> : null}<p className="scene-copy">You may update this response until the RSVP deadline.</p></div>;
}
