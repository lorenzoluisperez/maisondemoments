import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditEvents, events, guestGroups, guestLinks, guestRateLimits, guestSessions, guestSlots, invitationVersions,
  invitations, jobOrders, rsvpAttendees, rsvps,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/permissions";
import { canReadGuestExport } from "@/lib/auth/permissions";
import { isRsvpOpen, rsvpSubmissionSchema } from "@/lib/domain/rsvp";
import { getGuestSecrets, GUEST_SESSION_DAYS } from "@/lib/guests/config";
import {
  adminCorrectionSchema, createHouseholdSchema, importHouseholdsSchema, rotateLinkSchema, updateHouseholdSchema,
} from "@/lib/guests/contracts";
import { csvCell, parseHouseholdCsv } from "@/lib/guests/csv";
import { invitationSnapshotSchema } from "@/lib/invitation/config";
import { resolveGuestMediaReferences } from "@/lib/media/service";
import {
  decryptGuestToken, digestGuestSession, digestGuestToken, issueGuestCredential, issueGuestSession, matchesGuestToken,
} from "@/lib/security/guest-credentials";

const idSchema = z.string().uuid();
const slugSchema = z.string().min(1).max(200);

export class GuestAuthorizationError extends Error {}
export class GuestConflictError extends Error {}
export class GuestNotFoundError extends Error {}
export class GuestRateLimitError extends Error {}

export async function listHouseholds(actor: Actor, orderId: string) {
  const access = await requireHostAccess(actor, orderId);
  const permissions = { canCorrect: actor.accountType === "STAFF" && actor.roles.includes("ADMIN") };
  if (!access.invitationId) return { invitation: null, households: [], totals: emptyTotals(), permissions };
  const db = getDb();
  const [groups, slots, responses, attendees, links] = await Promise.all([
    db.select().from(guestGroups).where(eq(guestGroups.invitationId, access.invitationId)).orderBy(asc(guestGroups.createdAt)),
    db.select().from(guestSlots).innerJoin(guestGroups, eq(guestGroups.id, guestSlots.groupId)).where(eq(guestGroups.invitationId, access.invitationId)).orderBy(asc(guestSlots.displayOrder)),
    db.select().from(rsvps).innerJoin(guestGroups, eq(guestGroups.id, rsvps.groupId)).where(eq(guestGroups.invitationId, access.invitationId)),
    db.select().from(rsvpAttendees).innerJoin(rsvps, eq(rsvps.id, rsvpAttendees.rsvpId)).innerJoin(guestGroups, eq(guestGroups.id, rsvps.groupId)).where(eq(guestGroups.invitationId, access.invitationId)),
    db.select().from(guestLinks).innerJoin(guestGroups, eq(guestGroups.id, guestLinks.groupId)).where(and(eq(guestGroups.invitationId, access.invitationId), isNull(guestLinks.revokedAt))),
  ]);
  const { encryptionKey } = getGuestSecrets();
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  const households = groups.map((group) => {
    const response = responses.find((row) => row.rsvps.groupId === group.id)?.rsvps;
    const link = links.find((row) => row.guest_links.groupId === group.id)?.guest_links;
    const groupSlots = slots.filter((row) => row.guest_slots.groupId === group.id).map((row) => row.guest_slots);
    const responseAttendees = response ? attendees.filter((row) => row.rsvp_attendees.rsvpId === response.id).map((row) => row.rsvp_attendees) : [];
    return {
      ...group,
      slots: groupSlots,
      response: response ? { ...response, attendees: responseAttendees } : null,
      link: link ? { generation: link.generation, expiresAt: link.expiresAt, url: `${baseUrl}/i/${access.slug}#invite=${decryptGuestToken(link.encryptedToken, encryptionKey)}` } : null,
    };
  });
  return { invitation: { id: access.invitationId, slug: access.slug, availability: access.availability, expiresAt: access.expiresAt }, households, totals: calculateTotals(households), permissions };
}

export async function createHousehold(actor: Actor, orderId: string, input: unknown) {
  const parsed = createHouseholdSchema.parse(input);
  const access = await requireHostInvitation(actor, orderId);
  const secrets = getGuestSecrets();
  const credential = issueGuestCredential(secrets);
  await getDb().transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${access.invitationId}, 0))`);
    const [count] = await transaction.select({ value: sql<number>`count(*)::int` }).from(guestGroups).where(eq(guestGroups.invitationId, access.invitationId));
    if ((count?.value ?? 0) >= 500) throw new GuestConflictError("This invitation already has 500 households");
    const [group] = await transaction.insert(guestGroups).values({ invitationId: access.invitationId, label: parsed.label }).returning();
    await transaction.insert(guestSlots).values(parsed.slots.map((slot, displayOrder) => ({ groupId: group.id, type: slot.type, assignedName: slot.assignedName, isAdditionalGuest: slot.isAdditionalGuest, displayOrder })));
    await transaction.insert(guestLinks).values({ groupId: group.id, tokenDigest: credential.digest, encryptedToken: credential.encryptedToken, generation: 1, expiresAt: access.expiresAt });
    await transaction.insert(auditEvents).values({ actorAccountId: actor.accountId, action: "guest_household.created", entityType: "guest_group", entityId: group.id, metadata: { orderId: access.orderId, slots: parsed.slots.length } });
  });
  return listHouseholds(actor, access.orderId);
}

export async function importHouseholds(actor: Actor, orderId: string, input: unknown) {
  const { csv } = importHouseholdsSchema.parse(input);
  const entries = parseHouseholdCsv(csv);
  if (!entries.length) throw new GuestConflictError("The CSV contains no households");
  const access = await requireHostInvitation(actor, orderId);
  const secrets = getGuestSecrets();
  const credentials = entries.map(() => issueGuestCredential(secrets));
  await getDb().transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${access.invitationId}, 0))`);
    const [count] = await transaction.select({ value: sql<number>`count(*)::int` }).from(guestGroups).where(eq(guestGroups.invitationId, access.invitationId));
    if ((count?.value ?? 0) + entries.length > 500) throw new GuestConflictError("Import would exceed the 500-household limit");
    for (const [index, entry] of entries.entries()) {
      const [group] = await transaction.insert(guestGroups).values({ invitationId: access.invitationId, label: entry.label }).returning();
      await transaction.insert(guestSlots).values(entry.slots.map((slot, displayOrder) => ({ groupId: group.id, type: slot.type, assignedName: slot.assignedName, isAdditionalGuest: slot.isAdditionalGuest, displayOrder })));
      await transaction.insert(guestLinks).values({ groupId: group.id, tokenDigest: credentials[index].digest, encryptedToken: credentials[index].encryptedToken, generation: 1, expiresAt: access.expiresAt });
    }
    await transaction.insert(auditEvents).values({ actorAccountId: actor.accountId, action: "guest_household.imported", entityType: "invitation", entityId: access.invitationId, metadata: { orderId: access.orderId, households: entries.length } });
  });
  return listHouseholds(actor, access.orderId);
}

export async function updateHousehold(actor: Actor, orderId: string, groupId: string, input: unknown) {
  const parsedGroupId = idSchema.parse(groupId);
  const parsed = updateHouseholdSchema.parse(input);
  const access = await requireHostInvitation(actor, orderId);
  await getDb().transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${parsedGroupId}, 0))`);
    const [group] = await transaction.select().from(guestGroups).where(and(eq(guestGroups.id, parsedGroupId), eq(guestGroups.invitationId, access.invitationId))).limit(1);
    if (!group) throw new GuestNotFoundError("Household not found");
    if (group.revision !== parsed.expectedRevision) throw new GuestConflictError("A newer household revision exists");
    const existing = await transaction.select().from(guestSlots).where(eq(guestSlots.groupId, parsedGroupId));
    const suppliedIds = new Set(parsed.slots.flatMap((slot) => slot.id ? [slot.id] : []));
    if ([...suppliedIds].some((id) => !existing.some((slot) => slot.id === id))) throw new GuestConflictError("A guest slot does not belong to this household");
    const removed = existing.filter((slot) => !suppliedIds.has(slot.id)).map((slot) => slot.id);
    if (removed.length) {
      const occupied = await transaction.select({ id: rsvpAttendees.slotId }).from(rsvpAttendees).where(inArray(rsvpAttendees.slotId, removed));
      if (occupied.length) throw new GuestConflictError("Remove the occupied slot from the RSVP through an audited correction first");
      await transaction.delete(guestSlots).where(inArray(guestSlots.id, removed));
    }
    await transaction.update(guestSlots).set({ displayOrder: sql`${guestSlots.displayOrder} + 1000` }).where(eq(guestSlots.groupId, parsedGroupId));
    for (const [displayOrder, slot] of parsed.slots.entries()) {
      if (slot.id) await transaction.update(guestSlots).set({ type: slot.type, assignedName: slot.assignedName, isAdditionalGuest: slot.isAdditionalGuest, displayOrder }).where(eq(guestSlots.id, slot.id));
      else await transaction.insert(guestSlots).values({ groupId: parsedGroupId, type: slot.type, assignedName: slot.assignedName, isAdditionalGuest: slot.isAdditionalGuest, displayOrder });
    }
    await transaction.update(guestGroups).set({ label: parsed.label, active: parsed.active, revision: sql`${guestGroups.revision} + 1`, updatedAt: new Date() }).where(eq(guestGroups.id, parsedGroupId));
    await transaction.insert(auditEvents).values({ actorAccountId: actor.accountId, action: "guest_household.updated", entityType: "guest_group", entityId: parsedGroupId, metadata: { orderId: access.orderId, slots: parsed.slots.length, active: parsed.active } });
  });
  return listHouseholds(actor, access.orderId);
}

export async function rotateHouseholdLink(actor: Actor, orderId: string, groupId: string, input: unknown) {
  const parsedGroupId = idSchema.parse(groupId);
  const { reason } = rotateLinkSchema.parse(input);
  const access = await requireHostInvitation(actor, orderId);
  const secrets = getGuestSecrets();
  const credential = issueGuestCredential(secrets);
  await getDb().transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${parsedGroupId}, 0))`);
    const [group] = await transaction.select().from(guestGroups).where(and(eq(guestGroups.id, parsedGroupId), eq(guestGroups.invitationId, access.invitationId))).limit(1);
    if (!group) throw new GuestNotFoundError("Household not found");
    const [generation] = await transaction.select({ value: sql<number>`coalesce(max(${guestLinks.generation}), 0)::int` }).from(guestLinks).where(eq(guestLinks.groupId, parsedGroupId));
    await transaction.update(guestLinks).set({ revokedAt: new Date() }).where(and(eq(guestLinks.groupId, parsedGroupId), isNull(guestLinks.revokedAt)));
    await transaction.update(guestSessions).set({ revokedAt: new Date() }).where(and(eq(guestSessions.groupId, parsedGroupId), isNull(guestSessions.revokedAt)));
    await transaction.insert(guestLinks).values({ groupId: parsedGroupId, tokenDigest: credential.digest, encryptedToken: credential.encryptedToken, generation: (generation?.value ?? 0) + 1, expiresAt: access.expiresAt });
    await transaction.insert(auditEvents).values({ actorAccountId: actor.accountId, action: "guest_link.rotated", entityType: "guest_group", entityId: parsedGroupId, metadata: { orderId: access.orderId, reason, generation: (generation?.value ?? 0) + 1 } });
  });
  return listHouseholds(actor, access.orderId);
}

export async function revokeHouseholdLink(actor: Actor, orderId: string, groupId: string, input: unknown) {
  const parsedGroupId = idSchema.parse(groupId);
  const { reason } = rotateLinkSchema.parse(input);
  const access = await requireHostInvitation(actor, orderId);
  await getDb().transaction(async (transaction) => {
    const [group] = await transaction.select().from(guestGroups).where(and(eq(guestGroups.id, parsedGroupId), eq(guestGroups.invitationId, access.invitationId))).limit(1);
    if (!group) throw new GuestNotFoundError("Household not found");
    await transaction.update(guestLinks).set({ revokedAt: new Date() }).where(and(eq(guestLinks.groupId, parsedGroupId), isNull(guestLinks.revokedAt)));
    await transaction.update(guestSessions).set({ revokedAt: new Date() }).where(and(eq(guestSessions.groupId, parsedGroupId), isNull(guestSessions.revokedAt)));
    await transaction.insert(auditEvents).values({ actorAccountId: actor.accountId, action: "guest_link.revoked", entityType: "guest_group", entityId: parsedGroupId, metadata: { orderId: access.orderId, reason } });
  });
  return listHouseholds(actor, access.orderId);
}

export async function exchangeGuestLink(slug: string, token: string, rateKey: string) {
  const parsedSlug = slugSchema.parse(slug);
  const secrets = getGuestSecrets();
  await enforceRateLimit("exchange", rateKey, 12);
  const digest = digestGuestToken(token, secrets.pepper);
  const [row] = await getDb().select({
    groupId: guestGroups.id, active: guestGroups.active, generation: guestLinks.generation, tokenDigest: guestLinks.tokenDigest,
    linkExpiresAt: guestLinks.expiresAt, accessEpoch: invitations.accessEpoch, invitationExpiresAt: invitations.expiresAt,
    availability: invitations.availability,
  }).from(guestLinks)
    .innerJoin(guestGroups, eq(guestGroups.id, guestLinks.groupId))
    .innerJoin(invitations, eq(invitations.id, guestGroups.invitationId))
    .where(and(eq(guestLinks.tokenDigest, digest), eq(invitations.slug, parsedSlug), isNull(guestLinks.revokedAt))).limit(1);
  const now = new Date();
  if (!row || !matchesGuestToken(token, row.tokenDigest, secrets.pepper) || !row.active || row.availability !== "LIVE" || row.linkExpiresAt <= now || row.invitationExpiresAt <= now) {
    throw new GuestAuthorizationError("This invitation link is unavailable or has expired");
  }
  const session = issueGuestSession(secrets.pepper);
  const duration = new Date(now.getTime() + GUEST_SESSION_DAYS * 86400000);
  const expiresAt = new Date(Math.min(duration.getTime(), row.linkExpiresAt.getTime(), row.invitationExpiresAt.getTime()));
  await getDb().insert(guestSessions).values({ groupId: row.groupId, linkGeneration: row.generation, invitationAccessEpoch: row.accessEpoch, sessionDigest: session.digest, expiresAt });
  return { token: session.token, expiresAt };
}

export async function getGuestInvitation(slug: string, sessionToken: string) {
  const session = await requireGuestSession(slug, sessionToken);
  await enforceRateLimit("read", session.id, 60);
  const snapshot = invitationSnapshotSchema.parse(session.snapshot);
  const [slots, attendeeRows] = await Promise.all([
    getDb().select().from(guestSlots).where(eq(guestSlots.groupId, session.groupId)).orderBy(asc(guestSlots.displayOrder)),
    session.rsvpId ? getDb().select().from(rsvpAttendees).where(eq(rsvpAttendees.rsvpId, session.rsvpId)) : Promise.resolve([]),
  ]);
  const renderMedia = await resolveGuestMediaReferences(session.orderId, snapshot.media.gallery);
  return {
    invitation: { version: session.version, rsvpDeadline: session.rsvpDeadline, timezone: session.timezone },
    household: { id: session.groupId, label: session.label, slots },
    response: session.rsvpId ? { id: session.rsvpId, status: session.status, revision: session.rsvpRevision, note: session.note, attendees: attendeeRows } : null,
    rsvpOpen: isRsvpOpen(session.rsvpDeadline, new Date(), session.timezone),
    snapshot: { ...snapshot, renderMedia: { gallery: renderMedia } },
  };
}

export async function submitGuestRsvp(slug: string, sessionToken: string, input: unknown) {
  const parsed = rsvpSubmissionSchema.parse(input);
  const session = await requireGuestSession(slug, sessionToken);
  await enforceRateLimit("rsvp", session.id, 12);
  if (!isRsvpOpen(session.rsvpDeadline, new Date(), session.timezone)) throw new GuestConflictError("The RSVP deadline has passed");
  if (parsed.invitationVersion !== session.version) throw new GuestConflictError("The invitation was updated. Reload before responding");
  await getDb().transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${session.groupId}, 0))`);
    const slots = await transaction.select().from(guestSlots).where(eq(guestSlots.groupId, session.groupId));
    const selected = slots.filter((slot) => parsed.selectedSlotIds.includes(slot.id));
    if (selected.length !== parsed.selectedSlotIds.length) throw new GuestConflictError("RSVP contains a seat outside this household");
    for (const slot of selected) if (!slot.assignedName && slot.type === "ADULT" && !parsed.attendeeNames[slot.id]) {
      throw new GuestConflictError("Enter a name for each unnamed adult guest");
    }
    const [current] = await transaction.select().from(rsvps).where(eq(rsvps.groupId, session.groupId)).limit(1);
    if (current?.lastIdempotencyKey === parsed.idempotencyKey) return;
    if ((current?.revision ?? 0) !== parsed.expectedRevision) throw new GuestConflictError("This household response changed elsewhere. Reload it before saving");
    const [response] = current
      ? await transaction.update(rsvps).set({ status: parsed.status, revision: current.revision + 1, submittedInvitationVersion: parsed.invitationVersion, note: parsed.note || null, lastIdempotencyKey: parsed.idempotencyKey, updatedAt: new Date() }).where(eq(rsvps.id, current.id)).returning()
      : await transaction.insert(rsvps).values({ groupId: session.groupId, status: parsed.status, submittedInvitationVersion: parsed.invitationVersion, note: parsed.note || null, lastIdempotencyKey: parsed.idempotencyKey }).returning();
    await transaction.delete(rsvpAttendees).where(eq(rsvpAttendees.rsvpId, response.id));
    if (parsed.status === "ATTENDING" && selected.length) await transaction.insert(rsvpAttendees).values(selected.map((slot) => ({ rsvpId: response.id, slotId: slot.id, displayName: slot.assignedName ?? parsed.attendeeNames[slot.id] ?? null })));
    await transaction.insert(auditEvents).values({ actorAccountId: null, action: current ? "rsvp.amended" : "rsvp.submitted", entityType: "guest_group", entityId: session.groupId, metadata: { status: parsed.status, seats: selected.length, revision: response.revision, invitationVersion: parsed.invitationVersion } });
  });
  return getGuestInvitation(slug, sessionToken);
}

export async function correctHouseholdRsvp(actor: Actor, orderId: string, groupId: string, input: unknown) {
  if (actor.accountType !== "STAFF" || !actor.roles.includes("ADMIN")) throw new GuestAuthorizationError("Admin permission required");
  const parsed = adminCorrectionSchema.parse(input);
  const access = await requireHostInvitation(actor, orderId);
  const parsedGroupId = idSchema.parse(groupId);
  await getDb().transaction(async (transaction) => {
    const [group] = await transaction.select().from(guestGroups).where(and(eq(guestGroups.id, parsedGroupId), eq(guestGroups.invitationId, access.invitationId))).limit(1);
    if (!group) throw new GuestNotFoundError("Household not found");
    const slots = await transaction.select().from(guestSlots).where(eq(guestSlots.groupId, parsedGroupId));
    const selected = slots.filter((slot) => parsed.selectedSlotIds.includes(slot.id));
    if (selected.length !== parsed.selectedSlotIds.length) throw new GuestConflictError("Correction contains a seat outside this household");
    if (parsed.status === "DECLINED" && selected.length) throw new GuestConflictError("A declined response cannot contain attendees");
    if (parsed.status === "ATTENDING" && !selected.length) throw new GuestConflictError("Select at least one seat for an attending response");
    const [version] = await transaction.select({ number: invitationVersions.version }).from(invitations).innerJoin(invitationVersions, eq(invitationVersions.id, invitations.liveVersionId)).where(eq(invitations.id, access.invitationId)).limit(1);
    if (!version) throw new GuestConflictError("Publish the invitation before correcting responses");
    const [current] = await transaction.select().from(rsvps).where(eq(rsvps.groupId, parsedGroupId)).limit(1);
    const key = randomUUID();
    const [response] = current
      ? await transaction.update(rsvps).set({ status: parsed.status, revision: current.revision + 1, submittedInvitationVersion: version.number, note: parsed.note || null, lastIdempotencyKey: key, updatedAt: new Date() }).where(eq(rsvps.id, current.id)).returning()
      : await transaction.insert(rsvps).values({ groupId: parsedGroupId, status: parsed.status, submittedInvitationVersion: version.number, note: parsed.note || null, lastIdempotencyKey: key }).returning();
    await transaction.delete(rsvpAttendees).where(eq(rsvpAttendees.rsvpId, response.id));
    if (selected.length) await transaction.insert(rsvpAttendees).values(selected.map((slot) => ({ rsvpId: response.id, slotId: slot.id, displayName: slot.assignedName ?? parsed.attendeeNames[slot.id] ?? null })));
    await transaction.insert(auditEvents).values({ actorAccountId: actor.accountId, action: "rsvp.corrected", entityType: "guest_group", entityId: parsedGroupId, metadata: { reason: parsed.reason, status: parsed.status, seats: selected.length, revision: response.revision } });
  });
  return listHouseholds(actor, access.orderId);
}

export async function exportHouseholdCsv(actor: Actor, orderId: string) {
  const data = await listHouseholds(actor, orderId);
  if (!data.invitation) throw new GuestConflictError("Invitation has not been generated");
  const rows = [["household", "status", "allocated_adults", "allocated_children", "attendees", "note", "updated_at"]];
  for (const group of data.households) rows.push([
    group.label,
    group.response?.status ?? "NO_RESPONSE",
    String(group.slots.filter((slot) => slot.type === "ADULT").length),
    String(group.slots.filter((slot) => slot.type === "CHILD").length),
    group.response?.attendees.map((attendee) => attendee.displayName ?? "Unnamed guest").join("; ") ?? "",
    group.response?.note ?? "",
    group.response?.updatedAt.toISOString() ?? "",
  ]);
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

async function requireHostAccess(actor: Actor, orderId: string) {
  const parsedOrderId = idSchema.parse(orderId);
  const [row] = await getDb().select({
    orderId: jobOrders.id, customerId: jobOrders.customerId, invitationId: invitations.id, slug: invitations.slug,
    availability: invitations.availability, expiresAt: invitations.expiresAt,
  }).from(jobOrders).leftJoin(invitations, eq(invitations.jobOrderId, jobOrders.id)).where(eq(jobOrders.id, parsedOrderId)).limit(1);
  if (!row || !canReadGuestExport(actor, row)) throw new GuestNotFoundError("Job order not found");
  return row;
}

async function requireHostInvitation(actor: Actor, orderId: string) {
  const access = await requireHostAccess(actor, orderId);
  if (!access.invitationId || !access.slug || !access.expiresAt) throw new GuestConflictError("Submit the customer brief before managing households");
  return { ...access, invitationId: access.invitationId, slug: access.slug, expiresAt: access.expiresAt };
}

async function requireGuestSession(slug: string, token: string) {
  const parsedSlug = slugSchema.parse(slug);
  const digest = digestGuestSession(token, getGuestSecrets().pepper);
  const [row] = await getDb().select({
    id: guestSessions.id, groupId: guestGroups.id, label: guestGroups.label, active: guestGroups.active,
    linkGeneration: guestSessions.linkGeneration, sessionEpoch: guestSessions.invitationAccessEpoch, sessionExpiresAt: guestSessions.expiresAt,
    accessEpoch: invitations.accessEpoch, availability: invitations.availability, invitationExpiresAt: invitations.expiresAt,
    orderId: invitations.jobOrderId, snapshot: invitationVersions.snapshot, version: invitationVersions.version,
    rsvpDeadline: events.rsvpDeadline, timezone: events.timezone, rsvpId: rsvps.id, status: rsvps.status, rsvpRevision: rsvps.revision, note: rsvps.note,
  }).from(guestSessions)
    .innerJoin(guestGroups, eq(guestGroups.id, guestSessions.groupId))
    .innerJoin(invitations, eq(invitations.id, guestGroups.invitationId))
    .innerJoin(invitationVersions, eq(invitationVersions.id, invitations.liveVersionId))
    .innerJoin(events, eq(events.jobOrderId, invitations.jobOrderId))
    .leftJoin(rsvps, eq(rsvps.groupId, guestGroups.id))
    .where(and(eq(guestSessions.sessionDigest, digest), eq(invitations.slug, parsedSlug), isNull(guestSessions.revokedAt))).limit(1);
  const now = new Date();
  if (!row || !row.active || row.availability !== "LIVE" || row.sessionExpiresAt <= now || row.invitationExpiresAt <= now || row.sessionEpoch !== row.accessEpoch) throw new GuestAuthorizationError("Guest session is unavailable or expired");
  const [activeLink] = await getDb().select({ id: guestLinks.id }).from(guestLinks).where(and(eq(guestLinks.groupId, row.groupId), eq(guestLinks.generation, row.linkGeneration), isNull(guestLinks.revokedAt), sql`${guestLinks.expiresAt} > now()`)).limit(1);
  if (!activeLink) throw new GuestAuthorizationError("Guest session is unavailable or expired");
  return row;
}

async function enforceRateLimit(action: string, rawKey: string, limit: number) {
  const pepper = getGuestSecrets().pepper;
  const keyDigest = createHmac("sha256", pepper).update(`rate:${action}:${rawKey}`).digest("hex");
  const now = new Date();
  const windowStartedAt = new Date(Math.floor(now.getTime() / 60000) * 60000);
  const [row] = await getDb().insert(guestRateLimits).values({ keyDigest, action, windowStartedAt, attempts: 1 }).onConflictDoUpdate({
    target: [guestRateLimits.keyDigest, guestRateLimits.action, guestRateLimits.windowStartedAt],
    set: { attempts: sql`${guestRateLimits.attempts} + 1` },
  }).returning({ attempts: guestRateLimits.attempts });
  if (row.attempts > limit) throw new GuestRateLimitError("Too many requests. Wait a minute and try again");
}

function calculateTotals(households: Array<{ active: boolean; slots: Array<{ type: string }>; response: { status: string; attendees: unknown[] } | null }>) {
  return households.reduce((total, group) => {
    if (group.active) { total.households += 1; total.allocatedSeats += group.slots.length; }
    if (group.response?.status === "ATTENDING") { total.attendingHouseholds += 1; total.attendingGuests += group.response.attendees.length; }
    if (group.response?.status === "DECLINED") total.declinedHouseholds += 1;
    return total;
  }, emptyTotals());
}

function emptyTotals() { return { households: 0, allocatedSeats: 0, attendingHouseholds: 0, attendingGuests: 0, declinedHouseholds: 0 }; }
