"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ClipboardPlus, Plus } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";

type Options = { customers: Array<{ id: string; name: string; email: string }>; packages: Array<{ id: string; code: string; name: string }>; designers: Array<{ id: string; name: string }> };
const futureDate = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export function CreateOrderWorkspace() {
  const [options, setOptions] = useState<Options | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; jobNumber: string } | null>(null);
  const [working, setWorking] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ displayName: "", email: "" });
  const [form, setForm] = useState({
    customerId: "", assignedDesignerId: "", packageId: "", eventType: "wedding", collectionKey: "midnight-garden",
    primaryName: "", secondaryName: "", parentName: "", eventDate: futureDate(90), rsvpDeadline: futureDate(60), startTime: `${futureDate(90)}T15:00`,
    venueName: "", address: "", mapUrl: "https://maps.google.com", quotedAmount: "", depositAmount: "", dueDate: futureDate(30),
  });

  async function addCustomer() {
    setWorking(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/customers", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newCustomer) });
      const body = await response.json() as { customer?: Options["customers"][number]; error?: string };
      if (!response.ok || !body.customer) throw new Error(body.error ?? "The customer could not be created");
      setOptions((current) => current ? { ...current, customers: [...current.customers, body.customer!].sort((left, right) => left.name.localeCompare(right.name)) } : current);
      setForm((current) => ({ ...current, customerId: body.customer!.id }));
      setNewCustomer({ displayName: "", email: "" });
      setMessage("Customer added. They can use this email address to request a sign-in link.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The customer could not be created"); }
    finally { setWorking(false); }
  }

  useEffect(() => { void fetch("/api/admin/order-options", { cache: "no-store", credentials: "same-origin" }).then(async (response) => {
    const body = await response.json() as Options & { error?: string };
    if (!response.ok) { setMessage(body.error ?? "Order options could not be loaded"); return; }
    setOptions(body);
    setForm((current) => ({ ...current, customerId: body.customers[0]?.id ?? "", packageId: body.packages[0]?.id ?? "", assignedDesignerId: body.designers[0]?.id ?? "" }));
  }); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setWorking(true); setMessage(null); setCreated(null);
    const startsAt = new Date(`${form.startTime}:00+08:00`).toISOString();
    const person = (displayName: string, roleLabel: string) => ({ displayName, roleLabel });
    const common = {
      id: crypto.randomUUID(), type: form.eventType, timezone: "Asia/Manila", primaryLocalDate: form.eventDate, rsvpDeadline: form.rsvpDeadline,
      hostWording: form.eventType === "wedding" ? "Together with their families" : "You are warmly invited to celebrate", participants: [],
      activities: [{ id: crypto.randomUUID(), kind: form.eventType === "birthday" ? "party" : form.eventType === "debut" ? "program" : "ceremony", label: form.eventType === "birthday" ? "Celebration" : "Ceremony", startsAt, venueName: form.venueName, address: form.address, mapUrl: form.mapUrl }],
    };
    const details = form.eventType === "wedding" ? { partners: [person(form.primaryName, "Partner"), person(form.secondaryName, "Partner")] }
      : form.eventType === "birthday" ? { celebrant: person(form.primaryName, "Celebrant") }
        : form.eventType === "debut" ? { debutante: person(form.primaryName, "Debutante") }
          : { child: person(form.primaryName, "Child"), parentsOrGuardians: [person(form.parentName, "Parent or guardian")] };
    try {
      const response = await fetch("/api/orders", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        customerId: form.customerId, assignedDesignerId: form.assignedDesignerId || null, packageId: form.packageId, currency: "PHP",
        quotedAmountMinor: Math.round(Number(form.quotedAmount) * 100), depositRequiredMinor: Math.round(Number(form.depositAmount) * 100), dueDate: form.dueDate || null,
        collectionKey: form.collectionKey, event: { ...common, ...details },
      }) });
      const body = await response.json() as { order?: { id: string; jobNumber: string }; error?: string };
      if (!response.ok || !body.order) throw new Error(body.error ?? "The job order could not be created");
      setCreated(body.order);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The job order could not be created"); }
    finally { setWorking(false); }
  }

  return <AppShell area="studio"><header className="workspace-header"><div><p className="workspace-kicker">Commercial intake</p><h1>New job order</h1></div><Link className="workspace-button secondary" href="/studio">Back to studio</Link></header>
    {message ? <div className="workspace-alert"><AlertCircle />{message}</div> : null}
    {created ? <section className="order-created"><CheckCircle2 /><div><h2>{created.jobNumber} created</h2><p>The customer can now complete the brief in their portal.</p></div><Link className="workspace-button" href={`/portal?order=${created.id}`}>Open order</Link></section> : null}
    <form className="order-form" onSubmit={submit}><section><h2>Customer and package</h2><label>Customer<select required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">Select customer</option>{options?.customers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}</select></label><fieldset className="inline-customer"><legend>Add a new customer</legend><div className="form-columns"><label>Name<input value={newCustomer.displayName} onChange={(e) => setNewCustomer({ ...newCustomer, displayName: e.target.value })} /></label><label>Email<input type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} /></label></div><button type="button" className="workspace-button secondary" disabled={working || !newCustomer.displayName.trim() || !newCustomer.email.trim()} onClick={() => void addCustomer()}><Plus /> Add customer</button></fieldset><div className="form-columns"><label>Package<select required value={form.packageId} onChange={(e) => setForm({ ...form, packageId: e.target.value })}><option value="">Select package</option>{options?.packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Designer<select value={form.assignedDesignerId} onChange={(e) => setForm({ ...form, assignedDesignerId: e.target.value })}><option value="">Assign later</option>{options?.designers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div></section>
      <section><h2>Event baseline</h2><div className="form-columns"><label>Event type<select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })}><option value="wedding">Wedding</option><option value="birthday">Birthday</option><option value="debut">Debut</option><option value="christening">Christening</option></select></label><label>Collection<select value={form.collectionKey} onChange={(e) => setForm({ ...form, collectionKey: e.target.value })}><option value="midnight-garden">Midnight Garden</option><option value="luminous-parchment">Luminous Parchment</option></select></label></div><label>{form.eventType === "christening" ? "Child" : form.eventType === "birthday" ? "Celebrant" : form.eventType === "debut" ? "Debutante" : "First partner"}<input required value={form.primaryName} onChange={(e) => setForm({ ...form, primaryName: e.target.value })} /></label>{form.eventType === "wedding" ? <label>Second partner<input required value={form.secondaryName} onChange={(e) => setForm({ ...form, secondaryName: e.target.value })} /></label> : null}{form.eventType === "christening" ? <label>Parent or guardian<input required value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} /></label> : null}<div className="form-columns"><label>Event date<input required type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value, startTime: `${e.target.value}T15:00` })} /></label><label>RSVP deadline<input required type="date" max={form.eventDate} value={form.rsvpDeadline} onChange={(e) => setForm({ ...form, rsvpDeadline: e.target.value })} /></label></div><label>Start time<input required type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></label><label>Venue<input required value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value })} /></label><label>Address<input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label><label>HTTPS map link<input required type="url" value={form.mapUrl} onChange={(e) => setForm({ ...form, mapUrl: e.target.value })} /></label></section>
      <section><h2>Commercial terms</h2><div className="form-columns"><label>Quote (PHP)<input required min="0" step="0.01" type="number" value={form.quotedAmount} onChange={(e) => setForm({ ...form, quotedAmount: e.target.value })} /></label><label>Required deposit (PHP)<input required min="0" step="0.01" type="number" value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} /></label></div><label>Production due date<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label><button className="workspace-button" disabled={working || !options?.customers.length || !options?.packages.length}><ClipboardPlus />{working ? "Creating…" : "Create job order"}</button>{options && (!options.customers.length || !options.packages.length) ? <p className="form-help">At least one signed-in customer and one active package are required.</p> : null}</section></form>
  </AppShell>;
}
