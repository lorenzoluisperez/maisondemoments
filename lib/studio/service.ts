import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, eventBriefs, invitationDrafts, invitations, jobOrders } from "@/db/schema";
import { canEditInvitationDraft, canReadOrder, type Actor } from "@/lib/auth/permissions";
import { eventBriefDocumentSchema } from "@/lib/content/brief";
import { listContentOrders } from "@/lib/content/service";
import { compileInvitation } from "@/lib/invitation/compiler";
import { invitationConfigSchema } from "@/lib/invitation/config";
import { getCatalogArtwork } from "@/lib/media/catalog";
import { resolveMediaReferences } from "@/lib/media/service";
import { getJobOrder } from "@/lib/orders/service";
import { saveDraftOverridesSchema } from "@/lib/studio/contracts";

export class StudioAuthorizationError extends Error {}
export class StudioConflictError extends Error {
  constructor(message: string, public readonly currentRevision: number) {
    super(message);
  }
}
export class StudioNotFoundError extends Error {}

const orderIdSchema = z.string().uuid();

export async function listStudioOrders(actor: Actor) {
  if (actor.accountType !== "STAFF" || (!actor.roles.includes("DESIGNER") && !actor.roles.includes("ADMIN"))) {
    throw new StudioAuthorizationError("Staff permission required");
  }
  return listContentOrders(actor);
}

export async function getStudioOrder(actor: Actor, orderId: string) {
  const parsedOrderId = orderIdSchema.parse(orderId);
  const order = await getJobOrder(actor, parsedOrderId);
  if (!canEditInvitationDraft(actor, order)) throw new StudioAuthorizationError("This order is not assigned to you");
  const db = getDb();
  const [row] = await db.select({
    invitationId: invitations.id,
    slug: invitations.slug,
    configuration: invitationDrafts.configuration,
    revision: invitationDrafts.revision,
    reviewState: invitationDrafts.reviewState,
    updatedAt: invitationDrafts.updatedAt,
    briefDocument: eventBriefs.document,
  }).from(invitations)
    .innerJoin(invitationDrafts, eq(invitationDrafts.invitationId, invitations.id))
    .innerJoin(eventBriefs, eq(eventBriefs.jobOrderId, invitations.jobOrderId))
    .where(eq(invitations.jobOrderId, parsedOrderId)).limit(1);
  if (!row) throw new StudioNotFoundError("Submit the customer brief before opening the studio");
  const configuration = invitationConfigSchema.parse(row.configuration);
  const brief = eventBriefDocumentSchema.parse(row.briefDocument);
  const renderMedia = await resolveMediaReferences(actor, parsedOrderId, brief.gallery);
  const snapshot = compileInvitation({
    event: order.event,
    config: configuration,
    slug: row.slug,
    version: row.revision,
    media: { gallery: brief.gallery },
  });
  return {
    order: {
      id: order.id,
      jobNumber: order.jobNumber,
      customerId: order.customerId,
      eventType: order.event.type,
      collectionKey: order.collectionKey,
      state: order.state,
      dueDate: order.dueDate,
    },
    draft: {
      invitationId: row.invitationId,
      revision: row.revision,
      reviewState: row.reviewState,
      updatedAt: row.updatedAt,
      configuration,
    },
    snapshot: { ...snapshot, renderMedia: { gallery: renderMedia } },
  };
}

export async function saveDraftOverrides(actor: Actor, orderId: string, input: unknown) {
  const parsedOrderId = orderIdSchema.parse(orderId);
  const parsed = saveDraftOverridesSchema.parse(input);
  const db = getDb();
  const [current] = await db.select({
    customerId: jobOrders.customerId,
    assignedDesignerId: jobOrders.assignedDesignerId,
    collectionKey: jobOrders.collectionKey,
    invitationId: invitations.id,
    configuration: invitationDrafts.configuration,
    revision: invitationDrafts.revision,
    reviewState: invitationDrafts.reviewState,
  }).from(jobOrders)
    .innerJoin(invitations, eq(invitations.jobOrderId, jobOrders.id))
    .innerJoin(invitationDrafts, eq(invitationDrafts.invitationId, invitations.id))
    .where(eq(jobOrders.id, parsedOrderId)).limit(1);
  if (!current) throw new StudioNotFoundError("Invitation draft not found");
  if (!canReadOrder(actor, current) || !canEditInvitationDraft(actor, current)) throw new StudioAuthorizationError("This order is not assigned to you");
  if (current.revision !== parsed.expectedRevision) throw new StudioConflictError("A newer studio revision already exists", current.revision);
  if (current.reviewState !== "EDITING" && current.reviewState !== "CHANGES_REQUESTED") {
    throw new StudioConflictError("This draft is locked for review", current.revision);
  }

  const configuration = applyOverrides(invitationConfigSchema.parse(current.configuration), parsed);
  assertCatalogBoundaries(configuration, current.collectionKey);
  const [updated] = await db.transaction(async (transaction) => {
    const rows = await transaction.update(invitationDrafts).set({
      configuration,
      revision: sql`${invitationDrafts.revision} + 1`,
      reviewState: "EDITING",
      updatedAt: new Date(),
    }).where(and(
      eq(invitationDrafts.invitationId, current.invitationId),
      eq(invitationDrafts.revision, parsed.expectedRevision),
    )).returning();
    if (!rows.length) return [];
    await transaction.update(jobOrders).set({
      state: sql`case when ${jobOrders.state} = 'READY' then 'IN_PRODUCTION' else ${jobOrders.state} end`,
      updatedAt: new Date(),
    }).where(eq(jobOrders.id, parsedOrderId));
    await transaction.insert(auditEvents).values({
      actorAccountId: actor.accountId,
      action: "invitation_draft.autosaved",
      entityType: "invitation",
      entityId: current.invitationId,
      metadata: { fromRevision: parsed.expectedRevision, toRevision: rows[0].revision, sceneIds: parsed.scenes?.map((scene) => scene.id) ?? [] },
    });
    return rows;
  });
  if (!updated) {
    const [latest] = await db.select({ revision: invitationDrafts.revision }).from(invitationDrafts)
      .where(eq(invitationDrafts.invitationId, current.invitationId)).limit(1);
    throw new StudioConflictError("A newer studio revision already exists", latest?.revision ?? parsed.expectedRevision);
  }
  return getStudioOrder(actor, parsedOrderId);
}

function applyOverrides(configuration: z.infer<typeof invitationConfigSchema>, input: z.infer<typeof saveDraftOverridesSchema>) {
  const overrides = new Map((input.scenes ?? []).map((scene) => [scene.id, scene]));
  const scenes = configuration.scenes.map((scene) => {
    const override = overrides.get(scene.id);
    if (!override) return scene;
    const assets = scene.assets.map((asset) => asset.id === override.asset?.id ? { ...asset, ...override.asset } : asset);
    if (override.asset && !assets.some((asset) => asset.id === override.asset?.id)) throw new StudioNotFoundError("Decorative asset not found in scene");
    return { ...scene, ...(override.layoutVariant ? { layoutVariant: override.layoutVariant } : {}), assets };
  });
  if ([...overrides.keys()].some((id) => !configuration.scenes.some((scene) => scene.id === id))) throw new StudioNotFoundError("Scene not found");
  return invitationConfigSchema.parse({
    ...configuration,
    ...(input.typography ? { typography: input.typography } : {}),
    ...(input.animationIntensity ? { animationIntensity: input.animationIntensity } : {}),
    scenes,
  });
}

function assertCatalogBoundaries(configuration: z.infer<typeof invitationConfigSchema>, collectionKey: string) {
  if (configuration.themeVersion !== `${collectionKey}@1.0.0`) throw new StudioAuthorizationError("Theme version cannot be changed in the studio");
  for (const scene of configuration.scenes) for (const asset of scene.assets) {
    const catalog = getCatalogArtwork(asset.assetKey);
    if (!catalog || catalog.collectionKey !== collectionKey) throw new StudioAuthorizationError("Artwork must belong to the order collection");
  }
}
