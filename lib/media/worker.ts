import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, backgroundJobs, mediaObjects, mediaVariants } from "@/db/schema";
import { ImageValidationError, inspectAndProcessImage } from "@/lib/media/image-processor";
import {
  PRIVATE_MEDIA_BUCKET,
  processedObjectKey,
  QUARANTINE_BUCKET,
  validatedOriginalObjectKey,
} from "@/lib/media/policy";
import {
  downloadPrivateObject,
  MediaStorageError,
  putImmutablePrivateObject,
  removePrivateObjects,
} from "@/lib/media/storage";

const mediaJobPayloadSchema = z.object({ mediaId: z.string().uuid() }).strict();
const MAX_MEDIA_JOB_ATTEMPTS = 3;

export async function runMediaWorker(workerId: string, limit = 2) {
  const parsedWorkerId = z.string().trim().min(1).max(100).parse(workerId);
  const parsedLimit = z.number().int().min(1).max(4).parse(limit);
  const jobs = await getDb().execute<{ id: string; payload: unknown; attempts: number }>(sql`
    select job.id, job.payload, job.attempts
    from claim_background_jobs('PROCESS_MEDIA', ${parsedLimit}, 300) job
  `);

  const results = [];
  for (const job of jobs) {
    try {
      const { mediaId } = mediaJobPayloadSchema.parse(job.payload);
      const outcome = await processMediaObject(mediaId);
      await markJobSucceeded(job.id);
      results.push({ jobId: job.id, mediaId, outcome });
    } catch (error) {
      const retrying = await markJobFailedOrRetry(job, error);
      results.push({ jobId: job.id, outcome: retrying ? "RETRY_SCHEDULED" : "FAILED", errorCode: safeErrorCode(error) });
    }
  }
  return { workerId: parsedWorkerId, claimed: jobs.length, results };
}

export async function processMediaObject(mediaId: string) {
  const parsedMediaId = z.string().uuid().parse(mediaId);
  const db = getDb();
  const [media] = await db.select().from(mediaObjects).where(eq(mediaObjects.id, parsedMediaId)).limit(1);
  if (!media) throw new Error("MEDIA_NOT_FOUND");
  if (media.state === "READY") return "READY" as const;
  if (media.state === "REJECTED") return "REJECTED" as const;
  if (media.state === "DELETED") throw new Error("MEDIA_DELETED");
  if (!media.jobOrderId || !media.finalizedAt) throw new Error("MEDIA_NOT_FINALIZED");

  await db.update(mediaObjects).set({ state: "PROCESSING", failureCode: null, updatedAt: new Date() })
    .where(and(eq(mediaObjects.id, media.id), sql`${mediaObjects.state} in ('QUARANTINED', 'PROCESSING')`));

  try {
    const input = await downloadPrivateObject(media.bucket, media.storageKey);
    const processed = await inspectAndProcessImage(input);
    if (media.claimedContentType !== processed.detectedContentType) {
      throw new ImageValidationError("DETECTED_TYPE_MISMATCH", "Detected image type does not match the upload intent");
    }

    const originalKey = validatedOriginalObjectKey(media.jobOrderId, media.id, processed.detectedContentType);
    await putImmutablePrivateObject(originalKey, input, processed.detectedContentType);
    const preparedVariants = await Promise.all(processed.variants.map(async (variant) => {
      const storageKey = processedObjectKey(media.jobOrderId!, media.id, variant.width);
      await putImmutablePrivateObject(storageKey, variant.buffer, variant.contentType);
      return { ...variant, storageKey };
    }));

    await db.transaction(async (transaction) => {
      for (const variant of preparedVariants) {
        await transaction.insert(mediaVariants).values({
          sourceMediaId: media.id,
          bucket: PRIVATE_MEDIA_BUCKET,
          storageKey: variant.storageKey,
          contentType: variant.contentType,
          format: variant.format,
          width: variant.width,
          height: variant.height,
          bytes: variant.bytes,
          checksum: variant.checksum,
          recipeVersion: processed.recipeVersion,
        }).onConflictDoNothing({
          target: [mediaVariants.sourceMediaId, mediaVariants.recipeVersion, mediaVariants.width, mediaVariants.format],
        });
      }

      await transaction.update(mediaObjects).set({
        bucket: PRIVATE_MEDIA_BUCKET,
        storageKey: originalKey,
        detectedContentType: processed.detectedContentType,
        bytes: input.length,
        width: processed.width,
        height: processed.height,
        checksum: processed.checksum,
        state: "READY",
        failureCode: null,
        processingRecipeVersion: processed.recipeVersion,
        updatedAt: new Date(),
      }).where(eq(mediaObjects.id, media.id));
      await transaction.insert(auditEvents).values({
        actorAccountId: null,
        action: "media.processing_succeeded",
        entityType: "media_object",
        entityId: media.id,
        metadata: { recipeVersion: processed.recipeVersion, variants: preparedVariants.length },
      });
    });

    if (media.quarantineStorageKey) {
      try {
        await removePrivateObjects(media.bucket, [media.quarantineStorageKey]);
        await db.update(mediaObjects).set({ quarantineStorageKey: null, updatedAt: new Date() }).where(eq(mediaObjects.id, media.id));
      } catch {
        // Retain the quarantine key for the idempotent cleanup sweep.
      }
    }
    return "READY" as const;
  } catch (error) {
    if (error instanceof ImageValidationError) {
      await db.transaction(async (transaction) => {
        await transaction.update(mediaObjects).set({ state: "REJECTED", failureCode: error.code, updatedAt: new Date() })
          .where(eq(mediaObjects.id, media.id));
        await transaction.insert(auditEvents).values({
          actorAccountId: null,
          action: "media.processing_rejected",
          entityType: "media_object",
          entityId: media.id,
          metadata: { failureCode: error.code },
        });
      });
      return "REJECTED" as const;
    }
    throw error;
  }
}

export async function cleanupMediaStorage(now = new Date(), limit = 20) {
  const parsedLimit = z.number().int().min(1).max(100).parse(limit);
  const db = getDb();
  const quarantineCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const rejectedCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const stale = await db.execute<{
    id: string;
    bucket: string;
    storageKey: string;
    quarantineStorageKey: string | null;
    state: "QUARANTINED" | "REJECTED" | "DELETED";
  }>(sql`
    select media.id, media.bucket, media.storage_key as "storageKey",
      media.quarantine_storage_key as "quarantineStorageKey", media.state
    from media_objects media
    where (
      (media.state = 'QUARANTINED' and media.created_at < ${quarantineCutoff.toISOString()}::timestamptz)
      or (media.state = 'REJECTED' and media.created_at < ${rejectedCutoff.toISOString()}::timestamptz)
      or (media.state = 'DELETED' and media.storage_purged_at is null)
    )
    and not exists (select 1 from version_media_refs ref where ref.media_id = media.id)
    order by media.created_at, media.id
    limit ${parsedLimit}
  `);

  const deleted: string[] = [];
  for (const media of stale) {
    if (media.state !== "DELETED") {
      const marked = await db.execute<{ id: string }>(sql`
        update media_objects candidate
        set state = 'DELETED', deleted_at = ${now.toISOString()}::timestamptz,
          updated_at = ${now.toISOString()}::timestamptz
        where candidate.id = ${media.id}
          and not exists (select 1 from version_media_refs ref where ref.media_id = candidate.id)
        returning candidate.id
      `);
      if (!marked.length) continue;
    }
    const variants = await db.select().from(mediaVariants).where(eq(mediaVariants.sourceMediaId, media.id));
    const byBucket = new Map<string, string[]>();
    for (const item of [{ bucket: media.bucket, path: media.storageKey }, ...variants.map((variant) => ({ bucket: variant.bucket, path: variant.storageKey }))]) {
      byBucket.set(item.bucket, [...(byBucket.get(item.bucket) ?? []), item.path]);
    }
    if (media.quarantineStorageKey && media.quarantineStorageKey !== media.storageKey) {
      byBucket.set(QUARANTINE_BUCKET, [...(byBucket.get(QUARANTINE_BUCKET) ?? []), media.quarantineStorageKey]);
    }
    for (const [bucket, paths] of byBucket) await removePrivateObjects(bucket, paths);
    await db.update(mediaObjects).set({ storagePurgedAt: now, quarantineStorageKey: null, updatedAt: now }).where(eq(mediaObjects.id, media.id));
    deleted.push(media.id);
  }

  const orphanedQuarantine = await db.execute<{ id: string; quarantine_storage_key: string }>(sql`
    select id, quarantine_storage_key from media_objects
    where state = 'READY' and quarantine_storage_key is not null
    order by updated_at, id limit ${parsedLimit}
  `);
  for (const media of orphanedQuarantine) {
    await removePrivateObjects(QUARANTINE_BUCKET, [media.quarantine_storage_key]);
    await db.update(mediaObjects).set({ quarantineStorageKey: null, updatedAt: now }).where(eq(mediaObjects.id, media.id));
  }

  return { deleted, clearedQuarantineCopies: orphanedQuarantine.length };
}

async function markJobSucceeded(jobId: string) {
  await getDb().update(backgroundJobs).set({ state: "SUCCEEDED", leasedUntil: null, completedAt: new Date(), lastErrorCode: null })
    .where(eq(backgroundJobs.id, jobId));
}

async function markJobFailedOrRetry(job: { id: string; attempts: number }, error: unknown) {
  const failed = job.attempts >= MAX_MEDIA_JOB_ATTEMPTS;
  const delayMinutes = Math.min(2 ** Math.max(0, job.attempts - 1), 30);
  await getDb().update(backgroundJobs).set({
    state: failed ? "FAILED" : "PENDING",
    leasedUntil: null,
    availableAt: failed ? new Date() : new Date(Date.now() + delayMinutes * 60_000),
    completedAt: failed ? new Date() : null,
    lastErrorCode: safeErrorCode(error),
  }).where(eq(backgroundJobs.id, job.id));
  return !failed;
}

function safeErrorCode(error: unknown) {
  if (error instanceof ImageValidationError) return error.code;
  if (error instanceof MediaStorageError) return "MEDIA_STORAGE_ERROR";
  if (error instanceof z.ZodError) return "INVALID_JOB_PAYLOAD";
  if (error instanceof Error && /^[A-Z0-9_]{3,80}$/.test(error.message)) return error.message;
  return "MEDIA_PROCESSING_ERROR";
}
