import "server-only";

import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, backgroundJobs, mediaBackups, mediaObjects, mediaVariants } from "@/db/schema";
import { putVerifiedBackupObject } from "@/lib/backup/storage";
import { downloadPrivateObject } from "@/lib/media/storage";

const payloadSchema = z.object({ mediaId: z.string().uuid() }).strict();

export async function runBackupWorker(workerId: string, limit = 2) {
  const jobs = await getDb().execute<{ id: string; payload: unknown; attempts: number }>(sql`
    select id, payload, attempts from claim_background_jobs('BACKUP_MEDIA', ${Math.max(1, Math.min(limit, 4))}, 300)
  `);
  const results = [];
  for (const job of jobs) {
    try {
      const { mediaId } = payloadSchema.parse(job.payload);
      await backupMedia(mediaId);
      await getDb().update(backgroundJobs).set({ state: "SUCCEEDED", leasedUntil: null, completedAt: new Date(), lastErrorCode: null }).where(eq(backgroundJobs.id, job.id));
      results.push({ jobId: job.id, mediaId, outcome: "VERIFIED" });
    } catch (error) {
      const failed = job.attempts >= 5;
      const code = safeCode(error);
      await getDb().update(backgroundJobs).set({ state: failed ? "FAILED" : "PENDING", leasedUntil: null, completedAt: failed ? new Date() : null, availableAt: failed ? new Date() : new Date(Date.now() + Math.min(2 ** job.attempts, 30) * 60_000), lastErrorCode: code }).where(eq(backgroundJobs.id, job.id));
      const payload = payloadSchema.safeParse(job.payload);
      if (payload.success) await getDb().update(mediaBackups).set({ state: failed ? "FAILED" : "PENDING", attempts: job.attempts, lastErrorCode: code, updatedAt: new Date() }).where(eq(mediaBackups.mediaId, payload.data.mediaId));
      results.push({ jobId: job.id, outcome: failed ? "FAILED" : "RETRY_SCHEDULED", errorCode: code });
    }
  }
  return { workerId, claimed: jobs.length, results };
}

export async function enqueueMissingMediaBackups() {
  const rows = await getDb().execute<{ id: string; jobOrderId: string }>(sql`
    select media.id, media.job_order_id as "jobOrderId" from media_objects media
    left join media_backups backup on backup.media_id = media.id
    where media.state = 'READY' and media.usage <> 'CATALOG_ARTWORK' and backup.id is null and media.job_order_id is not null
    limit 100
  `);
  for (const media of rows) await queueMediaBackup(media.id, media.jobOrderId);
  return rows.length;
}

export async function queueMediaBackup(mediaId: string, jobOrderId: string) {
  const prefix = `orders/${jobOrderId}/media/${mediaId}`;
  await getDb().transaction(async (transaction) => {
    await transaction.insert(mediaBackups).values({ mediaId, provider: "s3", objectPrefix: prefix }).onConflictDoNothing();
    await transaction.insert(backgroundJobs).values({ kind: "BACKUP_MEDIA", payload: { mediaId }, idempotencyKey: `backup-media:${mediaId}` }).onConflictDoNothing();
  });
}

async function backupMedia(mediaId: string) {
  const db = getDb();
  const [media] = await db.select().from(mediaObjects).where(eq(mediaObjects.id, mediaId)).limit(1);
  if (!media || media.state !== "READY" || !media.jobOrderId || !media.checksum || !media.detectedContentType) throw new Error("MEDIA_NOT_READY_FOR_BACKUP");
  const variants = await db.select().from(mediaVariants).where(eq(mediaVariants.sourceMediaId, media.id));
  const prefix = `orders/${media.jobOrderId}/media/${media.id}`;
  const original = await downloadPrivateObject(media.bucket, media.storageKey);
  const manifest = [await putVerifiedBackupObject(`${prefix}/original`, original, media.detectedContentType, media.checksum)];
  for (const variant of variants) {
    const body = await downloadPrivateObject(variant.bucket, variant.storageKey);
    manifest.push(await putVerifiedBackupObject(`${prefix}/variants/${variant.width}.${variant.format}`, body, variant.contentType, variant.checksum));
  }
  const digest = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  await db.transaction(async (transaction) => {
    await transaction.update(mediaBackups).set({ state: "VERIFIED", manifest: { digest, objects: manifest }, verifiedAt: new Date(), lastErrorCode: null, updatedAt: new Date() }).where(eq(mediaBackups.mediaId, media.id));
    await transaction.insert(auditEvents).values({ actorAccountId: null, action: "media.backup_verified", entityType: "media_object", entityId: media.id, metadata: { provider: "s3", objectCount: manifest.length, manifestDigest: digest } });
  });
}

function safeCode(error: unknown) {
  const message = error instanceof Error ? error.message : "BACKUP_FAILED";
  return /^[A-Z0-9_]{3,80}$/.test(message) ? message : "BACKUP_FAILED";
}
