import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, backgroundJobs, jobOrders, mediaObjects, mediaVariants } from "@/db/schema";
import { canReadOrder, type Actor } from "@/lib/auth/permissions";
import {
  MAX_MEDIA_BYTES_PER_ORDER,
  MAX_MEDIA_PER_ORDER,
  MEDIA_SIGNED_URL_SECONDS,
  QUARANTINE_BUCKET,
  quarantineObjectKey,
  uploadIntentSchema,
  type UploadIntentInput,
} from "@/lib/media/policy";
import {
  createPrivateSignedUrls,
  createQuarantineUploadToken,
  getPrivateObjectInfo,
  MediaStorageError,
} from "@/lib/media/storage";
import type { ResolvedMediaAsset, SnapshotMediaReference } from "@/lib/media/types";

export class MediaAuthorizationError extends Error {}
export class MediaConflictError extends Error {}
export class MediaNotFoundError extends Error {}
export class MediaQuotaError extends Error {}

const mediaIdSchema = z.string().uuid();
const requestedWidthSchema = z.number().int().min(1).max(2000);

export async function createMediaUploadIntent(actor: Actor, input: UploadIntentInput) {
  const parsed = uploadIntentSchema.parse(input);
  const db = getDb();

  const media = await db.transaction(async (transaction) => {
    const [order] = await transaction
      .select({ id: jobOrders.id, customerId: jobOrders.customerId, assignedDesignerId: jobOrders.assignedDesignerId })
      .from(jobOrders)
      .where(eq(jobOrders.id, parsed.jobOrderId))
      .limit(1);
    if (!order) throw new MediaNotFoundError("Job order not found");
    if (!canReadOrder(actor, order)) throw new MediaAuthorizationError("Forbidden");

    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${parsed.jobOrderId}, 0))`);

    const [existing] = await transaction
      .select()
      .from(mediaObjects)
      .where(eq(mediaObjects.uploadIntentKey, parsed.idempotencyKey))
      .limit(1);
    if (existing) {
      if (existing.jobOrderId !== parsed.jobOrderId || existing.ownerAccountId !== order.customerId) {
        throw new MediaConflictError("Upload idempotency key belongs to another order");
      }
      if (existing.state !== "QUARANTINED") throw new MediaConflictError("Upload intent has already been finalized");
      return existing;
    }

    const [usage] = await transaction.execute<{ count: number; bytes: number }>(sql`
      select count(*)::int as count, coalesce(sum(bytes), 0)::int as bytes
      from media_objects
      where job_order_id = ${parsed.jobOrderId} and state <> 'DELETED'
    `);
    if ((usage?.count ?? 0) >= MAX_MEDIA_PER_ORDER || (usage?.bytes ?? 0) + parsed.bytes > MAX_MEDIA_BYTES_PER_ORDER) {
      throw new MediaQuotaError("This order has reached its media upload allowance");
    }

    const mediaId = randomUUID();
    const storageKey = quarantineObjectKey(parsed.jobOrderId, mediaId, parsed.filename);
    const [created] = await transaction.insert(mediaObjects).values({
      id: mediaId,
      ownerAccountId: order.customerId,
      jobOrderId: order.id,
      usage: "CUSTOMER_IMAGE",
      bucket: QUARANTINE_BUCKET,
      storageKey,
      quarantineStorageKey: storageKey,
      uploadIntentKey: parsed.idempotencyKey,
      originalFilename: parsed.filename,
      claimedContentType: parsed.contentType,
      bytes: parsed.bytes,
    }).returning();

    await transaction.insert(auditEvents).values({
      actorAccountId: actor.accountId,
      action: "media.upload_intent_created",
      entityType: "media_object",
      entityId: created.id,
      metadata: { jobOrderId: order.id, bytes: parsed.bytes, contentType: parsed.contentType },
    });
    return created;
  });

  const upload = await createQuarantineUploadToken(media.storageKey);
  return {
    mediaId: media.id,
    bucket: QUARANTINE_BUCKET,
    path: upload.path,
    token: upload.token,
    contentType: media.claimedContentType,
    bytes: media.bytes,
  };
}

export async function finalizeMediaUpload(actor: Actor, mediaId: string) {
  const media = await requireAuthorizedMedia(actor, mediaIdSchema.parse(mediaId));
  if (media.state === "READY" || media.state === "PROCESSING") return publicMediaStatus(media);
  if (media.state !== "QUARANTINED") throw new MediaConflictError("This upload cannot be finalized");

  let info: Awaited<ReturnType<typeof getPrivateObjectInfo>>;
  try {
    info = await getPrivateObjectInfo(media.bucket, media.storageKey);
  } catch (error) {
    if (error instanceof MediaStorageError) throw new MediaConflictError("The uploaded file was not found");
    throw error;
  }

  if (!info.size || info.size !== media.bytes) {
    await rejectBeforeProcessing(media.id, "UPLOAD_SIZE_MISMATCH");
    throw new MediaConflictError("Uploaded file size does not match the upload intent");
  }
  if (!info.contentType || info.contentType !== media.claimedContentType) {
    await rejectBeforeProcessing(media.id, "UPLOAD_TYPE_MISMATCH");
    throw new MediaConflictError("Uploaded content type does not match the upload intent");
  }

  const db = getDb();
  const finalized = await db.transaction(async (transaction) => {
    const [updated] = await transaction.update(mediaObjects).set({
      finalizedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(mediaObjects.id, media.id), eq(mediaObjects.state, "QUARANTINED"))).returning();
    if (!updated) {
      const [current] = await transaction.select().from(mediaObjects).where(eq(mediaObjects.id, media.id)).limit(1);
      if (!current) throw new MediaNotFoundError("Media upload not found");
      return current;
    }

    await transaction.insert(backgroundJobs).values({
      kind: "PROCESS_MEDIA",
      payload: { mediaId: media.id },
      idempotencyKey: `process-media:${media.id}:recipe-1`,
    }).onConflictDoNothing({ target: backgroundJobs.idempotencyKey });
    await transaction.insert(auditEvents).values({
      actorAccountId: actor.accountId,
      action: "media.upload_finalized",
      entityType: "media_object",
      entityId: media.id,
      metadata: { jobOrderId: media.jobOrderId },
    });
    return updated;
  });

  return publicMediaStatus(finalized);
}

export async function getMediaStatus(actor: Actor, mediaId: string) {
  return publicMediaStatus(await requireAuthorizedMedia(actor, mediaIdSchema.parse(mediaId)));
}

export async function getMediaDelivery(actor: Actor, mediaId: string, requestedWidth: number) {
  const parsedWidth = requestedWidthSchema.parse(requestedWidth);
  const media = await requireAuthorizedMedia(actor, mediaIdSchema.parse(mediaId));
  if (media.state !== "READY") throw new MediaConflictError("Media is not ready for delivery");
  const variants = await getDb().select().from(mediaVariants)
    .where(eq(mediaVariants.sourceMediaId, media.id))
    .orderBy(asc(mediaVariants.width));
  if (!variants.length) throw new MediaConflictError("Media has no delivery variants");
  const selected = variants.find((variant) => variant.width >= parsedWidth) ?? variants.at(-1)!;
  const urls = await createPrivateSignedUrls([selected.storageKey]);
  return {
    mediaId: media.id,
    src: urls.get(selected.storageKey)!,
    width: selected.width,
    height: selected.height,
    contentType: selected.contentType,
    expiresInSeconds: MEDIA_SIGNED_URL_SECONDS,
  };
}

export async function resolveMediaReferences(actor: Actor, jobOrderId: string, references: SnapshotMediaReference[]): Promise<ResolvedMediaAsset[]> {
  if (!references.length) return [];
  const parsedOrderId = z.string().uuid().parse(jobOrderId);
  const parsedReferences = z.array(z.object({ mediaId: z.string().uuid(), alt: z.string().trim().max(300) }).strict()).max(12).parse(references);
  const db = getDb();
  const [order] = await db.select({ customerId: jobOrders.customerId, assignedDesignerId: jobOrders.assignedDesignerId })
    .from(jobOrders).where(eq(jobOrders.id, parsedOrderId)).limit(1);
  if (!order) throw new MediaNotFoundError("Job order not found");
  if (!canReadOrder(actor, order)) throw new MediaAuthorizationError("Forbidden");

  const ids = [...new Set(parsedReferences.map((reference) => reference.mediaId))];
  const media = await db.select().from(mediaObjects).where(and(
    inArray(mediaObjects.id, ids),
    eq(mediaObjects.jobOrderId, parsedOrderId),
    eq(mediaObjects.state, "READY"),
  ));
  if (media.length !== ids.length) throw new MediaConflictError("One or more media references are unavailable for this order");
  const variants = await db.select().from(mediaVariants)
    .where(inArray(mediaVariants.sourceMediaId, ids))
    .orderBy(asc(mediaVariants.width));
  const paths = variants.map((variant) => variant.storageKey);
  const urls = await createPrivateSignedUrls(paths);

  return parsedReferences.map((reference) => {
    const sourceMedia = media.find((item) => item.id === reference.mediaId)!;
    const sources = variants.filter((variant) => variant.sourceMediaId === reference.mediaId).map((variant) => ({
      src: urls.get(variant.storageKey)!,
      width: variant.width,
      height: variant.height,
      contentType: variant.contentType,
    }));
    const largest = sources.at(-1);
    if (!largest) throw new MediaConflictError("A media reference has no delivery variant");
    return { mediaId: sourceMedia.id, alt: reference.alt, width: largest.width, height: largest.height, sources };
  });
}

async function requireAuthorizedMedia(actor: Actor, mediaId: string) {
  const [media] = await getDb().select({
    id: mediaObjects.id,
    ownerAccountId: mediaObjects.ownerAccountId,
    jobOrderId: mediaObjects.jobOrderId,
    usage: mediaObjects.usage,
    bucket: mediaObjects.bucket,
    storageKey: mediaObjects.storageKey,
    claimedContentType: mediaObjects.claimedContentType,
    detectedContentType: mediaObjects.detectedContentType,
    bytes: mediaObjects.bytes,
    width: mediaObjects.width,
    height: mediaObjects.height,
    state: mediaObjects.state,
    failureCode: mediaObjects.failureCode,
    processingRecipeVersion: mediaObjects.processingRecipeVersion,
    finalizedAt: mediaObjects.finalizedAt,
    customerId: jobOrders.customerId,
    assignedDesignerId: jobOrders.assignedDesignerId,
  }).from(mediaObjects)
    .innerJoin(jobOrders, eq(jobOrders.id, mediaObjects.jobOrderId))
    .where(eq(mediaObjects.id, mediaId))
    .limit(1);
  if (!media) throw new MediaNotFoundError("Media upload not found");
  if (!canReadOrder(actor, media)) throw new MediaAuthorizationError("Forbidden");
  return media;
}

async function rejectBeforeProcessing(mediaId: string, failureCode: string) {
  await getDb().update(mediaObjects).set({ state: "REJECTED", failureCode, updatedAt: new Date() }).where(eq(mediaObjects.id, mediaId));
}

function publicMediaStatus(media: { id: string; state: string; bytes: number; width: number | null; height: number | null; failureCode: string | null }) {
  return { mediaId: media.id, state: media.state, bytes: media.bytes, width: media.width, height: media.height, failureCode: media.failureCode };
}
