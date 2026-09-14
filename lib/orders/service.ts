import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
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
  jobOrders,
  packages,
  staffMemberships,
} from "@/db/schema";
import { canCreateOrder, canReadOrder, type Actor } from "@/lib/auth/permissions";
import { eventSchema, validateEventForSubmission, type Event } from "@/lib/domain/event";
import { briefFromEvent } from "@/lib/content/brief";
import { createJobOrderSchema, type CreateJobOrderInput } from "@/lib/orders/contracts";

const storedPersonSchema = z.object({
  displayName: z.string(),
  roleLabel: z.string(),
}).strict();

const storedEventDetailsSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("wedding"), hostWording: z.string().optional(), partners: z.tuple([storedPersonSchema, storedPersonSchema]) }).strict(),
  z.object({ type: z.literal("birthday"), hostWording: z.string().optional(), celebrant: storedPersonSchema, displayedAge: z.number().int().optional() }).strict(),
  z.object({ type: z.literal("debut"), hostWording: z.string().optional(), debutante: storedPersonSchema }).strict(),
  z.object({ type: z.literal("christening"), hostWording: z.string().optional(), child: storedPersonSchema, parentsOrGuardians: z.array(storedPersonSchema) }).strict(),
]);

const storedTextContentSchema = z.object({ text: z.string() }).strict();

export class OrderAuthorizationError extends Error {}
export class OrderNotFoundError extends Error {}
export class OrderReferenceError extends Error {}
export class OrderValidationError extends Error {}

export async function createJobOrder(
  actor: Actor,
  input: CreateJobOrderInput,
  options: { jobNumberYear?: number } = {},
) {
  if (!canCreateOrder(actor)) throw new OrderAuthorizationError("Admin permission required");

  const parsed = createJobOrderSchema.parse(input);
  const jobNumberYear = z.number().int().min(2020).max(9999).parse(options.jobNumberYear ?? new Date().getUTCFullYear());
  const eventValidation = validateEventForSubmission(parsed.event);
  if (!eventValidation.ready) throw new OrderValidationError("Event is not ready for persistence");
  const event = eventValidation.event;
  const db = getDb();

  const created = await db.transaction(async (transaction) => {
    const [customer] = await transaction
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, parsed.customerId), eq(accounts.type, "CUSTOMER"), eq(accounts.active, true)))
      .limit(1);
    if (!customer) throw new OrderReferenceError("Active customer account not found");

    const [selectedPackage] = await transaction
      .select({ id: packages.id })
      .from(packages)
      .where(and(eq(packages.id, parsed.packageId), eq(packages.active, true)))
      .limit(1);
    if (!selectedPackage) throw new OrderReferenceError("Active package not found");

    if (parsed.assignedDesignerId) {
      const [designer] = await transaction
        .select({ id: accounts.id })
        .from(accounts)
        .innerJoin(staffMemberships, eq(staffMemberships.accountId, accounts.id))
        .where(and(
          eq(accounts.id, parsed.assignedDesignerId),
          eq(accounts.type, "STAFF"),
          eq(accounts.active, true),
          eq(staffMemberships.role, "DESIGNER"),
        ))
        .limit(1);
      if (!designer) throw new OrderReferenceError("Assigned designer is not an active designer");
    }

    const allocation = await transaction.execute<{ jobNumber: string }>(
      sql`select allocate_job_order_number(${jobNumberYear}) as "jobNumber"`,
    );
    const jobNumber = allocation[0]?.jobNumber;
    if (!jobNumber) throw new Error("Job-order number allocation failed");

    const [order] = await transaction
      .insert(jobOrders)
      .values({
        jobNumber,
        customerId: parsed.customerId,
        assignedDesignerId: parsed.assignedDesignerId,
        packageId: parsed.packageId,
        currency: parsed.currency,
        quotedAmountMinor: parsed.quotedAmountMinor,
        depositRequiredMinor: parsed.depositRequiredMinor,
        dueDate: parsed.dueDate,
        collectionKey: parsed.collectionKey,
      })
      .returning({ id: jobOrders.id, jobNumber: jobOrders.jobNumber });

    const [storedEvent] = await transaction
      .insert(events)
      .values({
        id: event.id,
        jobOrderId: order.id,
        type: event.type,
        timezone: event.timezone,
        primaryLocalDate: event.primaryLocalDate,
        rsvpDeadline: event.rsvpDeadline,
        schemaVersion: 1,
        details: serializeEventDetails(event),
      })
      .returning({ id: events.id });

    await transaction.insert(eventActivities).values(event.activities.map((activity, displayOrder) => ({
      id: activity.id,
      eventId: storedEvent.id,
      kind: activity.kind,
      label: activity.label,
      startsAt: new Date(activity.startsAt),
      venueName: activity.venueName,
      address: activity.address,
      mapUrl: activity.mapUrl,
      displayOrder,
    })));

    if (event.participants.length) {
      await transaction.insert(eventParticipants).values(event.participants.map((participant, displayOrder) => ({
        groupKey: participantGroupKey(event.type),
        eventId: storedEvent.id,
        roleLabel: participant.roleLabel,
        displayName: participant.displayName,
        displayOrder,
      })));
    }

    const content = eventContentRows(storedEvent.id, event);
    if (content.length) await transaction.insert(eventContent).values(content);

    await transaction.insert(eventBriefs).values({
      jobOrderId: order.id,
      eventType: event.type,
      document: briefFromEvent(event),
    });

    await transaction.insert(auditEvents).values({
      actorAccountId: actor.accountId,
      action: "order.created",
      entityType: "job_order",
      entityId: order.id,
      metadata: { jobNumber: order.jobNumber, eventType: event.type },
    });

    return order;
  });

  return getJobOrder(actor, created.id);
}

export async function getJobOrder(actor: Actor, orderId: string) {
  const parsedOrderId = z.string().uuid().parse(orderId);
  const db = getDb();
  const [order] = await db
    .select({
      id: jobOrders.id,
      jobNumber: jobOrders.jobNumber,
      customerId: jobOrders.customerId,
      assignedDesignerId: jobOrders.assignedDesignerId,
      packageId: jobOrders.packageId,
      packageCode: packages.code,
      packageName: packages.name,
      state: jobOrders.state,
      currency: jobOrders.currency,
      quotedAmountMinor: jobOrders.quotedAmountMinor,
      depositRequiredMinor: jobOrders.depositRequiredMinor,
      dueDate: jobOrders.dueDate,
      collectionKey: jobOrders.collectionKey,
      createdAt: jobOrders.createdAt,
      updatedAt: jobOrders.updatedAt,
    })
    .from(jobOrders)
    .innerJoin(packages, eq(packages.id, jobOrders.packageId))
    .where(eq(jobOrders.id, parsedOrderId))
    .limit(1);

  if (!order) throw new OrderNotFoundError("Job order not found");
  if (!canReadOrder(actor, order)) throw new OrderAuthorizationError("Forbidden");

  const [storedEvent] = await db.select().from(events).where(eq(events.jobOrderId, order.id)).limit(1);
  if (!storedEvent) throw new OrderNotFoundError("Event not found for job order");

  const [activities, participants, contentRows] = await Promise.all([
    db.select().from(eventActivities).where(eq(eventActivities.eventId, storedEvent.id)).orderBy(asc(eventActivities.displayOrder)),
    db.select().from(eventParticipants).where(eq(eventParticipants.eventId, storedEvent.id)).orderBy(asc(eventParticipants.displayOrder)),
    db.select().from(eventContent).where(eq(eventContent.eventId, storedEvent.id)),
  ]);

  return {
    ...order,
    event: hydrateEvent(storedEvent, activities, participants, contentRows),
  };
}

export function serializeEventDetails(event: Event) {
  const common = event.hostWording ? { hostWording: event.hostWording } : {};
  switch (event.type) {
    case "wedding": return { type: event.type, ...common, partners: event.partners };
    case "birthday": return { type: event.type, ...common, celebrant: event.celebrant, ...(event.displayedAge ? { displayedAge: event.displayedAge } : {}) };
    case "debut": return { type: event.type, ...common, debutante: event.debutante };
    case "christening": return { type: event.type, ...common, child: event.child, parentsOrGuardians: event.parentsOrGuardians };
  }
}

export function participantGroupKey(type: Event["type"]) {
  if (type === "wedding") return "wedding_party";
  if (type === "debut") return "candles";
  if (type === "christening") return "godparents";
  return "participants";
}

export function eventContentRows(eventId: string, event: Event) {
  return [
    event.story ? { eventId, moduleKey: "story", schemaVersion: 1, content: { text: event.story } } : null,
    event.dressCode ? { eventId, moduleKey: "dress_code", schemaVersion: 1, content: { text: event.dressCode } } : null,
    event.giftInformation ? { eventId, moduleKey: "gift_information", schemaVersion: 1, content: { text: event.giftInformation } } : null,
  ].filter((row): row is NonNullable<typeof row> => row !== null);
}

function hydrateEvent(
  storedEvent: typeof events.$inferSelect,
  activities: Array<typeof eventActivities.$inferSelect>,
  participants: Array<typeof eventParticipants.$inferSelect>,
  contentRows: Array<typeof eventContent.$inferSelect>,
) {
  const details = storedEventDetailsSchema.parse(storedEvent.details);
  if (details.type !== storedEvent.type) throw new OrderValidationError("Stored event type does not match its details");

  const content = new Map(contentRows.map((row) => [row.moduleKey, storedTextContentSchema.parse(row.content).text]));
  return eventSchema.parse({
    id: storedEvent.id,
    type: storedEvent.type,
    timezone: storedEvent.timezone,
    primaryLocalDate: storedEvent.primaryLocalDate,
    rsvpDeadline: storedEvent.rsvpDeadline,
    hostWording: details.hostWording,
    activities: activities.map((activity) => ({
      id: activity.id,
      kind: activity.kind,
      label: activity.label,
      startsAt: activity.startsAt.toISOString(),
      venueName: activity.venueName,
      address: activity.address,
      mapUrl: activity.mapUrl,
    })),
    participants: participants.map((participant) => ({ roleLabel: participant.roleLabel, displayName: participant.displayName })),
    story: content.get("story"),
    dressCode: content.get("dress_code"),
    giftInformation: content.get("gift_information"),
    ...eventSpecificDetails(details),
  });
}

function eventSpecificDetails(details: z.infer<typeof storedEventDetailsSchema>) {
  switch (details.type) {
    case "wedding": return { partners: details.partners };
    case "birthday": return { celebrant: details.celebrant, ...(details.displayedAge ? { displayedAge: details.displayedAge } : {}) };
    case "debut": return { debutante: details.debutante };
    case "christening": return { child: details.child, parentsOrGuardians: details.parentsOrGuardians };
  }
}
