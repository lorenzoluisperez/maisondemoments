import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  accounts,
  auditEvents,
  eventActivities,
  eventBriefs,
  eventContent,
  eventParticipants,
  events,
  invitationDrafts,
  invitations,
  jobOrders,
  mediaObjects,
  paymentEntries,
  themes,
  themeVersions,
} from "@/db/schema";
import { canEditOrderContent, canReadOrder, type Actor } from "@/lib/auth/permissions";
import { briefFromEvent, completeEventFromBrief, eventBriefDocumentSchema, saveEventBriefSchema, type EventBriefDocument } from "@/lib/content/brief";
import { createPreset } from "@/lib/invitation/presets";
import { eventContentRows, getJobOrder, participantGroupKey, serializeEventDetails } from "@/lib/orders/service";

export class ContentAuthorizationError extends Error {}
export class ContentConflictError extends Error {
  constructor(message: string, public readonly currentRevision: number) {
    super(message);
  }
}
export class ContentNotFoundError extends Error {}
export class ContentSubmissionError extends Error {
  constructor(public readonly issues: Array<{ section: string; path: string; message: string }>) {
    super("The brief is incomplete");
  }
}

const orderIdSchema = z.string().uuid();
export const submitEventBriefSchema = z.object({ expectedRevision: z.number().int().positive() }).strict();

export async function listContentOrders(actor: Actor) {
  const db = getDb();
  const access = actor.accountType === "CUSTOMER"
    ? eq(jobOrders.customerId, actor.accountId)
    : actor.roles.includes("ADMIN")
      ? undefined
      : and(eq(jobOrders.assignedDesignerId, actor.accountId), sql`${jobOrders.state} <> 'CANCELLED'`);
  if (actor.accountType === "STAFF" && !actor.roles.includes("ADMIN") && !actor.roles.includes("DESIGNER")) return [];

  return db.select({
    id: jobOrders.id,
    jobNumber: jobOrders.jobNumber,
    customerName: accounts.displayName,
    state: jobOrders.state,
    dueDate: jobOrders.dueDate,
    collectionKey: jobOrders.collectionKey,
    eventType: events.type,
    eventDate: events.primaryLocalDate,
    briefRevision: eventBriefs.revision,
    briefSubmittedAt: eventBriefs.submittedAt,
    invitationId: invitations.id,
    draftRevision: invitationDrafts.revision,
  }).from(jobOrders)
    .innerJoin(accounts, eq(accounts.id, jobOrders.customerId))
    .innerJoin(events, eq(events.jobOrderId, jobOrders.id))
    .leftJoin(eventBriefs, eq(eventBriefs.jobOrderId, jobOrders.id))
    .leftJoin(invitations, eq(invitations.jobOrderId, jobOrders.id))
    .leftJoin(invitationDrafts, eq(invitationDrafts.invitationId, invitations.id))
    .where(access)
    .orderBy(asc(jobOrders.dueDate), asc(jobOrders.createdAt));
}

export async function getEventBrief(actor: Actor, orderId: string) {
  const parsedOrderId = orderIdSchema.parse(orderId);
  const order = await getJobOrder(actor, parsedOrderId);
  const db = getDb();
  let [brief] = await db.select().from(eventBriefs).where(eq(eventBriefs.jobOrderId, parsedOrderId)).limit(1);
  if (!brief) {
    [brief] = await db.insert(eventBriefs).values({
      jobOrderId: parsedOrderId,
      eventType: order.event.type,
      document: briefFromEvent(order.event),
    }).onConflictDoNothing().returning();
    if (!brief) [brief] = await db.select().from(eventBriefs).where(eq(eventBriefs.jobOrderId, parsedOrderId)).limit(1);
  }
  if (!brief) throw new ContentNotFoundError("Event brief not found");
  const document = eventBriefDocumentSchema.parse(brief.document);
  return {
    order: {
      id: order.id,
      jobNumber: order.jobNumber,
      state: order.state,
      collectionKey: order.collectionKey,
      dueDate: order.dueDate,
    },
    document,
    revision: brief.revision,
    submittedAt: brief.submittedAt,
    updatedAt: brief.updatedAt,
    completion: await briefCompletion(parsedOrderId, document),
  };
}

export async function saveEventBrief(actor: Actor, orderId: string, input: unknown) {
  const parsedOrderId = orderIdSchema.parse(orderId);
  const parsed = saveEventBriefSchema.parse(input);
  const db = getDb();
  const [order] = await db.select({
    customerId: jobOrders.customerId,
    assignedDesignerId: jobOrders.assignedDesignerId,
    eventType: events.type,
    eventId: events.id,
  }).from(jobOrders).innerJoin(events, eq(events.jobOrderId, jobOrders.id)).where(eq(jobOrders.id, parsedOrderId)).limit(1);
  if (!order) throw new ContentNotFoundError("Job order not found");
  if (!canReadOrder(actor, order)) throw new ContentAuthorizationError("Forbidden");
  if (!canEditOrderContent(actor, order)) throw new ContentAuthorizationError("Only the customer owner or an admin may edit event content");
  if (parsed.document.event.type !== order.eventType || parsed.document.event.id !== order.eventId) {
    throw new ContentSubmissionError([{ section: "identity", path: "event.type", message: "The event identity cannot be changed" }]);
  }

  const [updated] = await db.transaction(async (transaction) => {
    const rows = await transaction.update(eventBriefs).set({
      document: parsed.document,
      revision: sql`${eventBriefs.revision} + 1`,
      submittedAt: null,
      updatedAt: new Date(),
    }).where(and(eq(eventBriefs.jobOrderId, parsedOrderId), eq(eventBriefs.revision, parsed.expectedRevision))).returning();
    if (!rows.length) return [];
    await transaction.update(jobOrders).set({
      state: sql`case when ${jobOrders.state} = 'NEW' then 'COLLECTING' else ${jobOrders.state} end`,
      submittedAt: null,
      updatedAt: new Date(),
    }).where(eq(jobOrders.id, parsedOrderId));
    await transaction.insert(auditEvents).values({
      actorAccountId: actor.accountId,
      action: "event_brief.saved",
      entityType: "job_order",
      entityId: parsedOrderId,
      metadata: { revision: rows[0].revision },
    });
    return rows;
  });
  if (!updated) {
    const [current] = await db.select({ revision: eventBriefs.revision }).from(eventBriefs).where(eq(eventBriefs.jobOrderId, parsedOrderId)).limit(1);
    throw new ContentConflictError("A newer brief revision already exists", current?.revision ?? parsed.expectedRevision);
  }
  return getEventBrief(actor, parsedOrderId);
}

export async function submitEventBrief(actor: Actor, orderId: string, input: unknown) {
  const parsedOrderId = orderIdSchema.parse(orderId);
  const { expectedRevision } = submitEventBriefSchema.parse(input);
  const current = await getEventBrief(actor, parsedOrderId);
  if (!canEditOrderContent(actor, { customerId: (await getJobOrder(actor, parsedOrderId)).customerId })) {
    throw new ContentAuthorizationError("Only the customer owner or an admin may submit event content");
  }
  if (current.revision !== expectedRevision) throw new ContentConflictError("A newer brief revision already exists", current.revision);
  const completion = await briefCompletion(parsedOrderId, current.document);
  if (!completion.ready) throw new ContentSubmissionError(completion.issues);
  const completed = completeEventFromBrief(current.document);
  if (!completed.ready) throw new ContentSubmissionError(completed.issues);
  const event = completed.event;
  const db = getDb();

  await db.transaction(async (transaction) => {
    const [order] = await transaction.select().from(jobOrders).where(eq(jobOrders.id, parsedOrderId)).limit(1);
    if (!order) throw new ContentNotFoundError("Job order not found");
    const [brief] = await transaction.update(eventBriefs).set({
      submittedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(eventBriefs.jobOrderId, parsedOrderId), eq(eventBriefs.revision, expectedRevision))).returning();
    if (!brief) throw new ContentConflictError("A newer brief revision already exists", expectedRevision + 1);

    await transaction.update(events).set({
      timezone: event.timezone,
      primaryLocalDate: event.primaryLocalDate,
      rsvpDeadline: event.rsvpDeadline,
      details: serializeEventDetails(event),
      contentRevision: sql`${events.contentRevision} + 1`,
    }).where(eq(events.jobOrderId, parsedOrderId));
    await transaction.delete(eventActivities).where(eq(eventActivities.eventId, event.id));
    await transaction.delete(eventParticipants).where(eq(eventParticipants.eventId, event.id));
    await transaction.delete(eventContent).where(eq(eventContent.eventId, event.id));
    await transaction.insert(eventActivities).values(event.activities.map((activity, displayOrder) => ({
      id: activity.id,
      eventId: event.id,
      kind: activity.kind,
      label: activity.label,
      startsAt: new Date(activity.startsAt),
      venueName: activity.venueName,
      address: activity.address,
      mapUrl: activity.mapUrl,
      displayOrder,
    })));
    if (event.participants.length) await transaction.insert(eventParticipants).values(event.participants.map((participant, displayOrder) => ({
      eventId: event.id,
      groupKey: participantGroupKey(event.type),
      roleLabel: participant.roleLabel,
      displayName: participant.displayName,
      displayOrder,
    })));
    const contentRows = eventContentRows(event.id, event);
    if (contentRows.length) await transaction.insert(eventContent).values(contentRows);

    const [releasedTheme] = await transaction.select({ id: themeVersions.id }).from(themeVersions)
      .innerJoin(themes, eq(themes.id, themeVersions.themeId))
      .where(and(eq(themes.key, order.collectionKey), eq(themeVersions.version, "1.0.0"))).limit(1);
    if (!releasedTheme) throw new ContentSubmissionError([{ section: "identity", path: "collection", message: "The selected collection is not released" }]);
    const expiry = new Date(`${event.primaryLocalDate}T23:59:59.999Z`);
    expiry.setUTCDate(expiry.getUTCDate() + 90);
    const [invitation] = await transaction.insert(invitations).values({
      jobOrderId: parsedOrderId,
      slug: order.jobNumber.toLowerCase(),
      expiresAt: expiry,
    }).onConflictDoUpdate({ target: invitations.jobOrderId, set: { expiresAt: expiry } }).returning();
    const [draft] = await transaction.select().from(invitationDrafts).where(eq(invitationDrafts.invitationId, invitation.id)).limit(1);
    if (draft) {
      await transaction.update(invitationDrafts).set({
        revision: sql`${invitationDrafts.revision} + 1`,
        reviewState: "EDITING",
        updatedAt: new Date(),
      }).where(eq(invitationDrafts.invitationId, invitation.id));
    } else {
      await transaction.insert(invitationDrafts).values({
        invitationId: invitation.id,
        themeVersionId: releasedTheme.id,
        configuration: createPreset(event.type, order.collectionKey as "midnight-garden" | "luminous-parchment"),
      });
    }

    const [paid] = await transaction.select({ amount: sql<number>`coalesce(sum(${paymentEntries.amountMinor}), 0)::bigint` })
      .from(paymentEntries).where(eq(paymentEntries.jobOrderId, parsedOrderId));
    const productionReady = Boolean(order.assignedDesignerId) && Number(paid?.amount ?? 0) >= order.depositRequiredMinor;
    await transaction.update(jobOrders).set({
      state: productionReady ? "READY" : "COLLECTING",
      submittedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(jobOrders.id, parsedOrderId));
    await transaction.insert(auditEvents).values({
      actorAccountId: actor.accountId,
      action: draft ? "event_brief.resubmitted" : "invitation_draft.generated",
      entityType: "job_order",
      entityId: parsedOrderId,
      metadata: { briefRevision: expectedRevision, invitationId: invitation.id, productionReady },
    });
  });

  return getEventBrief(actor, parsedOrderId);
}

async function briefCompletion(orderId: string, document: EventBriefDocument) {
  const facts = completeEventFromBrief(document);
  const issues = facts.ready ? [] : [...facts.issues];
  if (document.gallery.length) {
    const ids = [...new Set(document.gallery.map((item) => item.mediaId))];
    const media = await getDb().select({ id: mediaObjects.id, state: mediaObjects.state }).from(mediaObjects)
      .where(and(eq(mediaObjects.jobOrderId, orderId), inArray(mediaObjects.id, ids)));
    const readyIds = new Set(media.filter((item) => item.state === "READY").map((item) => item.id));
    for (const reference of document.gallery) if (!readyIds.has(reference.mediaId)) {
      issues.push({ section: "photos", path: `gallery.${reference.mediaId}`, message: "This image is still processing or unavailable" });
    }
  }
  const failingSections = new Set(issues.map((issue) => issue.section));
  const totalSections = 5;
  return { ready: issues.length === 0, percent: Math.round((totalSections - failingSections.size) / totalSections * 100), issues };
}
