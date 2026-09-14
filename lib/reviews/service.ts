import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  approvals, auditEvents, eventBriefs, invitationDrafts, invitationVersions, invitations, jobOrders,
  paymentEntries, reviewItems, reviewRequests, versionMediaRefs,
} from "@/db/schema";
import { canEditInvitationDraft, canReadOrder, type Actor } from "@/lib/auth/permissions";
import { completeEventFromBrief, eventBriefDocumentSchema } from "@/lib/content/brief";
import { compileInvitation } from "@/lib/invitation/compiler";
import { invitationConfigSchema, invitationSnapshotSchema, type InvitationSnapshot } from "@/lib/invitation/config";
import { resolveMediaReferences } from "@/lib/media/service";
import {
  availabilityActionSchema, createReviewVersionSchema, materialChangesSchema, publishVersionSchema, requestChangesSchema,
} from "@/lib/reviews/contracts";
import { describeMaterialChanges } from "@/lib/reviews/material-changes";

export class ReviewAuthorizationError extends Error {}
export class ReviewConflictError extends Error {}
export class ReviewNotFoundError extends Error {}
export class PublicationBlockedError extends Error {}

const idSchema = z.string().uuid();

export async function createReviewVersion(actor: Actor, orderId: string, input: unknown) {
  const parsedOrderId = idSchema.parse(orderId);
  const parsed = createReviewVersionSchema.parse(input);
  const db = getDb();
  const versionId = await db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${parsedOrderId}, 0))`);
    const [row] = await transaction.select({
      customerId: jobOrders.customerId,
      assignedDesignerId: jobOrders.assignedDesignerId,
      orderState: jobOrders.state,
      invitationId: invitations.id,
      slug: invitations.slug,
      liveVersionId: invitations.liveVersionId,
      configuration: invitationDrafts.configuration,
      revision: invitationDrafts.revision,
      reviewState: invitationDrafts.reviewState,
      briefDocument: eventBriefs.document,
      briefSubmittedAt: eventBriefs.submittedAt,
    }).from(jobOrders)
      .innerJoin(eventBriefs, eq(eventBriefs.jobOrderId, jobOrders.id))
      .innerJoin(invitations, eq(invitations.jobOrderId, jobOrders.id))
      .innerJoin(invitationDrafts, eq(invitationDrafts.invitationId, invitations.id))
      .where(eq(jobOrders.id, parsedOrderId)).limit(1);
    if (!row) throw new ReviewNotFoundError("Invitation draft not found");
    if (!canEditInvitationDraft(actor, row)) throw new ReviewAuthorizationError("This order is not assigned to you");
    if (!row.briefSubmittedAt) throw new ReviewConflictError("The customer brief must be submitted before review");
    if (!(["READY", "IN_PRODUCTION", "DELIVERED"] as const).includes(row.orderState as "READY" | "IN_PRODUCTION" | "DELIVERED")) {
      throw new ReviewConflictError("The deposit and production-readiness gate must pass before client review");
    }
    if (row.revision !== parsed.expectedRevision) throw new ReviewConflictError("A newer draft revision already exists");
    if (row.reviewState !== "EDITING" && row.reviewState !== "CHANGES_REQUESTED") throw new ReviewConflictError("This draft is already locked for review");

    const completed = completeEventFromBrief(eventBriefDocumentSchema.parse(row.briefDocument));
    if (!completed.ready) throw new ReviewConflictError("The submitted event content is no longer complete");
    const [latest] = await transaction.select({ version: invitationVersions.version, snapshot: invitationVersions.snapshot })
      .from(invitationVersions).where(eq(invitationVersions.invitationId, row.invitationId))
      .orderBy(desc(invitationVersions.version)).limit(1);
    const nextVersion = (latest?.version ?? 0) + 1;
    const compiled = compileInvitation({
      event: completed.event,
      config: invitationConfigSchema.parse(row.configuration),
      slug: row.slug,
      version: nextVersion,
      media: { gallery: eventBriefDocumentSchema.parse(row.briefDocument).gallery },
    });
    const { contentHash, ...snapshot } = compiled;
    let previousSnapshot: InvitationSnapshot | undefined;
    if (row.liveVersionId) {
      const [live] = await transaction.select({ snapshot: invitationVersions.snapshot }).from(invitationVersions)
        .where(eq(invitationVersions.id, row.liveVersionId)).limit(1);
      if (live) previousSnapshot = invitationSnapshotSchema.parse(live.snapshot);
    } else if (latest) previousSnapshot = invitationSnapshotSchema.parse(latest.snapshot);
    const materialChanges = describeMaterialChanges(snapshot, previousSnapshot);
    const [created] = await transaction.insert(invitationVersions).values({
      invitationId: row.invitationId,
      version: nextVersion,
      sourceRevision: row.revision,
      snapshot,
      contentHash,
      rendererVersion: snapshot.config.rendererVersion,
      materialChanges,
      createdBy: actor.accountId,
    }).returning({ id: invitationVersions.id });
    if (snapshot.media.gallery.length) await transaction.insert(versionMediaRefs).values(
      [...new Set(snapshot.media.gallery.map((item) => item.mediaId))].map((mediaId) => ({ versionId: created.id, mediaId })),
    );
    const [locked] = await transaction.update(invitationDrafts).set({ reviewState: "IN_REVIEW", updatedAt: new Date() })
      .where(and(eq(invitationDrafts.invitationId, row.invitationId), eq(invitationDrafts.revision, parsed.expectedRevision)))
      .returning({ invitationId: invitationDrafts.invitationId });
    if (!locked) throw new ReviewConflictError("A newer draft revision already exists");
    await transaction.update(jobOrders).set({
      state: sql`case when ${jobOrders.state} = 'READY' then 'IN_PRODUCTION'::production_state else ${jobOrders.state} end`,
      updatedAt: new Date(),
    }).where(eq(jobOrders.id, parsedOrderId));
    await transaction.insert(auditEvents).values({
      actorAccountId: actor.accountId,
      action: "invitation.review_created",
      entityType: "invitation_version",
      entityId: created.id,
      metadata: { invitationId: row.invitationId, version: nextVersion, sourceRevision: row.revision, checklist: parsed.checklist, materialChanges },
    });
    return created.id;
  });
  return getReviewVersion(actor, versionId);
}

export async function getReviewVersion(actor: Actor, versionId: string) {
  const parsedVersionId = idSchema.parse(versionId);
  const db = getDb();
  const [row] = await db.select({
    id: invitationVersions.id,
    version: invitationVersions.version,
    sourceRevision: invitationVersions.sourceRevision,
    snapshot: invitationVersions.snapshot,
    contentHash: invitationVersions.contentHash,
    rendererVersion: invitationVersions.rendererVersion,
    materialChanges: invitationVersions.materialChanges,
    createdAt: invitationVersions.createdAt,
    invitationId: invitations.id,
    jobOrderId: jobOrders.id,
    jobNumber: jobOrders.jobNumber,
    customerId: jobOrders.customerId,
    assignedDesignerId: jobOrders.assignedDesignerId,
    draftRevision: invitationDrafts.revision,
    reviewState: invitationDrafts.reviewState,
    liveVersionId: invitations.liveVersionId,
    availability: invitations.availability,
  }).from(invitationVersions)
    .innerJoin(invitations, eq(invitations.id, invitationVersions.invitationId))
    .innerJoin(jobOrders, eq(jobOrders.id, invitations.jobOrderId))
    .innerJoin(invitationDrafts, eq(invitationDrafts.invitationId, invitations.id))
    .where(eq(invitationVersions.id, parsedVersionId)).limit(1);
  if (!row) throw new ReviewNotFoundError("Review version not found");
  if (!canReadOrder(actor, row)) throw new ReviewAuthorizationError("Review version not found");
  const snapshot = invitationSnapshotSchema.parse(row.snapshot);
  const [approval] = await db.select({ customerId: approvals.customerId, approvedAt: approvals.approvedAt })
    .from(approvals).where(eq(approvals.versionId, row.id)).limit(1);
  const [request] = await db.select({ id: reviewRequests.id, summary: reviewRequests.summary, createdAt: reviewRequests.createdAt })
    .from(reviewRequests).where(eq(reviewRequests.versionId, row.id)).limit(1);
  const items = request ? await db.select({ sectionKey: reviewItems.sectionKey, message: reviewItems.message, displayOrder: reviewItems.displayOrder })
    .from(reviewItems).where(eq(reviewItems.reviewRequestId, request.id)).orderBy(asc(reviewItems.displayOrder)) : [];
  const current = row.sourceRevision === row.draftRevision;
  const isOwner = actor.accountType === "CUSTOMER" && actor.accountId === row.customerId;
  const renderMedia = await resolveMediaReferences(actor, row.jobOrderId, snapshot.media.gallery);
  return {
    order: { id: row.jobOrderId, jobNumber: row.jobNumber },
    invitation: { id: row.invitationId, liveVersionId: row.liveVersionId, availability: row.availability },
    version: {
      id: row.id, number: row.version, sourceRevision: row.sourceRevision, contentHash: row.contentHash,
      rendererVersion: row.rendererVersion, materialChanges: materialChangesSchema.parse(row.materialChanges), createdAt: row.createdAt,
    },
    reviewState: row.reviewState,
    current,
    approval: approval ?? null,
    changeRequest: request ? { summary: request.summary, createdAt: request.createdAt, items } : null,
    permissions: {
      canDecide: isOwner && current && row.reviewState === "IN_REVIEW" && !approval && !request,
      canPublish: actor.accountType === "STAFF" && actor.roles.includes("ADMIN") && Boolean(approval),
    },
    snapshot: { ...snapshot, renderMedia: { gallery: renderMedia } },
  };
}

export async function listReviewHistory(actor: Actor, orderId: string) {
  const parsedOrderId = idSchema.parse(orderId);
  const db = getDb();
  const [order] = await db.select({
    customerId: jobOrders.customerId,
    assignedDesignerId: jobOrders.assignedDesignerId,
    invitationId: invitations.id,
    liveVersionId: invitations.liveVersionId,
    availability: invitations.availability,
    expiresAt: invitations.expiresAt,
    publishedAt: invitations.publishedAt,
    quotedAmountMinor: jobOrders.quotedAmountMinor,
    currency: jobOrders.currency,
    draftRevision: invitationDrafts.revision,
    reviewState: invitationDrafts.reviewState,
  }).from(jobOrders).leftJoin(invitations, eq(invitations.jobOrderId, jobOrders.id))
    .leftJoin(invitationDrafts, eq(invitationDrafts.invitationId, invitations.id))
    .where(eq(jobOrders.id, parsedOrderId)).limit(1);
  if (!order || !canReadOrder(actor, order)) throw new ReviewNotFoundError("Job order not found");
  if (!order.invitationId) return { invitation: null, versions: [], balance: null, permissions: { canPublish: false } };
  const versions = await db.select({
    id: invitationVersions.id,
    number: invitationVersions.version,
    sourceRevision: invitationVersions.sourceRevision,
    contentHash: invitationVersions.contentHash,
    rendererVersion: invitationVersions.rendererVersion,
    materialChanges: invitationVersions.materialChanges,
    createdAt: invitationVersions.createdAt,
    approvedAt: approvals.approvedAt,
    changesRequestedAt: reviewRequests.createdAt,
  }).from(invitationVersions)
    .leftJoin(approvals, eq(approvals.versionId, invitationVersions.id))
    .leftJoin(reviewRequests, eq(reviewRequests.versionId, invitationVersions.id))
    .where(eq(invitationVersions.invitationId, order.invitationId)).orderBy(desc(invitationVersions.version));
  const [payment] = await db.select({ total: sql<number>`coalesce(sum(${paymentEntries.amountMinor}), 0)::bigint` })
    .from(paymentEntries).where(eq(paymentEntries.jobOrderId, parsedOrderId));
  const paid = Number(payment?.total ?? 0);
  return {
    invitation: { id: order.invitationId, liveVersionId: order.liveVersionId, availability: order.availability, expiresAt: order.expiresAt, publishedAt: order.publishedAt, reviewState: order.reviewState, draftRevision: order.draftRevision },
    versions: versions.map((version) => ({ ...version, materialChanges: materialChangesSchema.parse(version.materialChanges), live: version.id === order.liveVersionId, current: version.sourceRevision === order.draftRevision })),
    balance: { quotedAmountMinor: order.quotedAmountMinor, paidAmountMinor: paid, outstandingAmountMinor: Math.max(0, order.quotedAmountMinor - paid), currency: order.currency },
    permissions: { canPublish: actor.accountType === "STAFF" && actor.roles.includes("ADMIN") },
  };
}

export async function approveReviewVersion(actor: Actor, versionId: string) {
  const parsedVersionId = idSchema.parse(versionId);
  const db = getDb();
  await db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${parsedVersionId}, 0))`);
    const row = await requireCurrentCustomerReview(transaction, actor, parsedVersionId);
    await transaction.insert(approvals).values({ versionId: parsedVersionId, customerId: actor.accountId });
    await transaction.update(invitationDrafts).set({ reviewState: "APPROVED", updatedAt: new Date() })
      .where(eq(invitationDrafts.invitationId, row.invitationId));
    await transaction.insert(auditEvents).values({
      actorAccountId: actor.accountId, action: "invitation.review_approved", entityType: "invitation_version", entityId: parsedVersionId,
      metadata: { invitationId: row.invitationId, version: row.version },
    });
  });
  return getReviewVersion(actor, parsedVersionId);
}

export async function requestReviewChanges(actor: Actor, versionId: string, input: unknown) {
  const parsedVersionId = idSchema.parse(versionId);
  const parsed = requestChangesSchema.parse(input);
  const db = getDb();
  await db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${parsedVersionId}, 0))`);
    const row = await requireCurrentCustomerReview(transaction, actor, parsedVersionId);
    const [request] = await transaction.insert(reviewRequests).values({ versionId: parsedVersionId, requestedBy: actor.accountId, summary: parsed.summary })
      .returning({ id: reviewRequests.id });
    await transaction.insert(reviewItems).values(parsed.items.map((item, displayOrder) => ({ reviewRequestId: request.id, ...item, displayOrder })));
    await transaction.update(invitationDrafts).set({ reviewState: "CHANGES_REQUESTED", updatedAt: new Date() })
      .where(eq(invitationDrafts.invitationId, row.invitationId));
    await transaction.insert(auditEvents).values({
      actorAccountId: actor.accountId, action: "invitation.changes_requested", entityType: "invitation_version", entityId: parsedVersionId,
      metadata: { invitationId: row.invitationId, version: row.version, itemCount: parsed.items.length },
    });
  });
  return getReviewVersion(actor, parsedVersionId);
}

export async function publishApprovedVersion(actor: Actor, invitationId: string, input: unknown) {
  requireAdmin(actor);
  const parsedInvitationId = idSchema.parse(invitationId);
  const { versionId } = publishVersionSchema.parse(input);
  try {
    await getDb().execute(sql`select publish_approved_invitation(${parsedInvitationId}, ${versionId}, ${actor.accountId})`);
  } catch (error) {
    throw new PublicationBlockedError(publicationMessage(error));
  }
  const [order] = await getDb().select({ id: invitations.jobOrderId }).from(invitations).where(eq(invitations.id, parsedInvitationId)).limit(1);
  if (!order) throw new ReviewNotFoundError("Invitation not found");
  return listReviewHistory(actor, order.id);
}

export async function rollbackApprovedVersion(actor: Actor, invitationId: string, input: unknown) {
  requireAdmin(actor);
  const parsedInvitationId = idSchema.parse(invitationId);
  const { versionId } = publishVersionSchema.parse(input);
  try {
    await getDb().execute(sql`select rollback_approved_invitation(${parsedInvitationId}, ${versionId}, ${actor.accountId})`);
  } catch (error) {
    throw new PublicationBlockedError(publicationMessage(error));
  }
  const [order] = await getDb().select({ id: invitations.jobOrderId }).from(invitations).where(eq(invitations.id, parsedInvitationId)).limit(1);
  if (!order) throw new ReviewNotFoundError("Invitation not found");
  return listReviewHistory(actor, order.id);
}

export async function changeInvitationAvailability(actor: Actor, invitationId: string, input: unknown) {
  requireAdmin(actor);
  const parsedInvitationId = idSchema.parse(invitationId);
  const parsed = availabilityActionSchema.parse(input);
  const db = getDb();
  const orderId = await db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${parsedInvitationId}, 0))`);
    const [current] = await transaction.select().from(invitations).where(eq(invitations.id, parsedInvitationId)).limit(1);
    if (!current) throw new ReviewNotFoundError("Invitation not found");
    const target = parsed.action === "suspend" ? "SUSPENDED" : parsed.action === "resume" ? "LIVE" : "EXPIRED";
    const auditAction = parsed.action === "suspend" ? "suspended" : parsed.action === "resume" ? "resumed" : "expired";
    const allowed = parsed.action === "suspend" ? current.availability === "LIVE"
      : parsed.action === "resume" ? current.availability === "SUSPENDED" && current.expiresAt > new Date() && Boolean(current.liveVersionId)
        : current.availability === "LIVE" || current.availability === "SUSPENDED";
    if (!allowed) throw new PublicationBlockedError(`Cannot ${parsed.action} an invitation in ${current.availability.toLowerCase()} state`);
    await transaction.update(invitations).set({
      availability: target,
      accessEpoch: parsed.action === "resume" ? current.accessEpoch : current.accessEpoch + 1,
      updatedAt: new Date(),
    }).where(eq(invitations.id, parsedInvitationId));
    await transaction.insert(auditEvents).values({
      actorAccountId: actor.accountId, action: `invitation.${auditAction}`, entityType: "invitation", entityId: parsedInvitationId,
      metadata: { from: current.availability, to: target, reason: parsed.reason },
    });
    return current.jobOrderId;
  });
  return listReviewHistory(actor, orderId);
}

async function requireCurrentCustomerReview(transaction: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0], actor: Actor, versionId: string) {
  const [row] = await transaction.select({
    invitationId: invitations.id, customerId: jobOrders.customerId, version: invitationVersions.version,
    sourceRevision: invitationVersions.sourceRevision, draftRevision: invitationDrafts.revision, reviewState: invitationDrafts.reviewState,
  }).from(invitationVersions)
    .innerJoin(invitations, eq(invitations.id, invitationVersions.invitationId))
    .innerJoin(jobOrders, eq(jobOrders.id, invitations.jobOrderId))
    .innerJoin(invitationDrafts, eq(invitationDrafts.invitationId, invitations.id))
    .where(eq(invitationVersions.id, versionId)).limit(1);
  if (!row || actor.accountType !== "CUSTOMER" || actor.accountId !== row.customerId) throw new ReviewAuthorizationError("Review version not found");
  if (row.reviewState !== "IN_REVIEW" || row.sourceRevision !== row.draftRevision) throw new ReviewConflictError("This review version is no longer awaiting a decision");
  const decisions = await transaction.select({ approvalId: approvals.id, requestId: reviewRequests.id }).from(invitationVersions)
    .leftJoin(approvals, eq(approvals.versionId, invitationVersions.id))
    .leftJoin(reviewRequests, eq(reviewRequests.versionId, invitationVersions.id))
    .where(eq(invitationVersions.id, versionId)).limit(1);
  if (decisions[0]?.approvalId || decisions[0]?.requestId) throw new ReviewConflictError("A decision has already been recorded for this version");
  return row;
}

function requireAdmin(actor: Actor) {
  if (actor.accountType !== "STAFF" || !actor.roles.includes("ADMIN")) throw new ReviewAuthorizationError("Admin permission required");
}

function publicationMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Publication failed";
  const known = [
    "Outstanding balance blocks publication", "Exact version has not been approved by the customer",
    "Approved version is not the current draft revision", "Invitation must be active and unexpired before publication",
    "Version does not belong to invitation", "Invitation has no live version to roll back",
    "Renderer compatibility blocks rollback", "Rollback requires a customer-approved version",
  ].find((value) => message.includes(value));
  return known ?? "Publication could not be completed";
}
