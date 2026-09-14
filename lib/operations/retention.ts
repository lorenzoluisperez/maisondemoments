import "server-only";

import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  approvals, auditEvents, deletionRecords, eventBriefs, events, guestGroups, guestLinks, guestRateLimits, guestSessions,
  invitations, jobOrders, mediaBackups, mediaObjects, notificationDeliveries, reviewRequests,
} from "@/db/schema";
import { putVerifiedBackupObject, removeBackupPrefix } from "@/lib/backup/storage";

export async function runRetentionSweep(now = new Date()) {
  const db = getDb();
  const expiryCandidates = await db.select({ id: invitations.id, jobOrderId: invitations.jobOrderId, slug: invitations.slug }).from(invitations)
    .where(sql`${invitations.expiresAt} <= ${now} and ${invitations.availability} in ('LIVE', 'SUSPENDED')`).limit(100);
  const expired: string[] = [];
  for (const invitation of expiryCandidates) await db.transaction(async (transaction) => {
    const [updated] = await transaction.update(invitations).set({ availability: "EXPIRED", accessEpoch: sql`${invitations.accessEpoch} + 1`, updatedAt: now })
      .where(sql`${invitations.id} = ${invitation.id} and ${invitations.availability} in ('LIVE', 'SUSPENDED') and ${invitations.expiresAt} <= ${now}`).returning({ id: invitations.id });
    if (!updated) return;
    const groups = transaction.select({ id: guestGroups.id }).from(guestGroups).where(eq(guestGroups.invitationId, invitation.id));
    await transaction.update(guestLinks).set({ revokedAt: now }).where(sql`${guestLinks.groupId} in (${groups}) and ${guestLinks.revokedAt} is null`);
    await transaction.update(guestSessions).set({ revokedAt: now }).where(sql`${guestSessions.groupId} in (${groups}) and ${guestSessions.revokedAt} is null`);
    await transaction.insert(deletionRecords).values({ jobOrderId: invitation.jobOrderId, invitationId: invitation.id, slugDigest: createHash("sha256").update(invitation.slug).digest("hex"), reason: "Hosting period expired", executeAfter: new Date(now.getTime() + 30 * 86400000) }).onConflictDoNothing();
    await transaction.insert(auditEvents).values({ actorAccountId: null, action: "invitation.expired_automatically", entityType: "invitation", entityId: invitation.id, metadata: { expiredAt: now.toISOString() } });
    expired.push(invitation.id);
  });

  const due = await db.select().from(deletionRecords).where(sql`${deletionRecords.contentPurgedAt} is null and ${deletionRecords.executeAfter} <= ${now}`).limit(10);
  const purged: string[] = [];
  const failed: Array<{ id: string; errorCode: string }> = [];
  for (const record of due) {
    try {
      await exportTombstone(record);
      await purgeInvitation(record.id, now);
      purged.push(record.id);
    } catch (error) {
      failed.push({ id: record.id, errorCode: error instanceof Error && /^[A-Z0-9_]{3,80}$/.test(error.message) ? error.message : "RETENTION_PURGE_FAILED" });
    }
  }
  await db.delete(guestRateLimits).where(sql`${guestRateLimits.windowStartedAt} < ${new Date(now.getTime() - 86400000)}`);
  return { expired: expired.length, purged, failed };
}

async function exportTombstone(record: typeof deletionRecords.$inferSelect) {
  if (record.tombstoneExportedAt) return;
  const body = Buffer.from(JSON.stringify({ schemaVersion: 1, deletionRecordId: record.id, jobOrderId: record.jobOrderId, invitationId: record.invitationId, slugDigest: record.slugDigest, requestedAt: record.requestedAt.toISOString(), executeAfter: record.executeAfter.toISOString() }));
  const checksum = createHash("sha256").update(body).digest("hex");
  await putVerifiedBackupObject(`deletions/${record.id}.json`, body, "application/json", checksum);
  await getDb().update(deletionRecords).set({ tombstoneExportedAt: new Date() }).where(eq(deletionRecords.id, record.id));
}

async function purgeInvitation(recordId: string, now: Date) {
  const db = getDb();
  const [recordBeforePurge] = await db.select().from(deletionRecords).where(eq(deletionRecords.id, recordId)).limit(1);
  if (!recordBeforePurge || recordBeforePurge.contentPurgedAt) return;
  const backups = await db.select({ id: mediaBackups.id, objectPrefix: mediaBackups.objectPrefix }).from(mediaBackups)
    .innerJoin(mediaObjects, eq(mediaObjects.id, mediaBackups.mediaId)).where(eq(mediaObjects.jobOrderId, recordBeforePurge.jobOrderId));
  for (const backup of backups) {
    await removeBackupPrefix(backup.objectPrefix);
    await db.update(mediaBackups).set({ state: "DELETED", manifest: {}, updatedAt: now }).where(eq(mediaBackups.id, backup.id));
  }
  await db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${recordId}, 0))`);
    const [record] = await transaction.select().from(deletionRecords).where(eq(deletionRecords.id, recordId)).limit(1);
    if (!record || record.contentPurgedAt) return;
    await transaction.delete(approvals).where(sql`${approvals.versionId} in (select id from invitation_versions where invitation_id = ${record.invitationId})`);
    await transaction.delete(reviewRequests).where(sql`${reviewRequests.versionId} in (select id from invitation_versions where invitation_id = ${record.invitationId})`);
    await transaction.delete(invitations).where(eq(invitations.id, record.invitationId));
    await transaction.delete(eventBriefs).where(eq(eventBriefs.jobOrderId, record.jobOrderId));
    await transaction.delete(events).where(eq(events.jobOrderId, record.jobOrderId));
    await transaction.execute(sql`delete from background_jobs where kind = 'SEND_EMAIL' and payload->>'deliveryId' in (select id::text from notification_deliveries where job_order_id = ${record.jobOrderId})`);
    await transaction.delete(notificationDeliveries).where(eq(notificationDeliveries.jobOrderId, record.jobOrderId));
    await transaction.update(mediaObjects).set({ state: "DELETED", originalFilename: "deleted", claimedContentType: null, failureCode: null, deletedAt: now, updatedAt: now })
      .where(sql`${mediaObjects.jobOrderId} = ${record.jobOrderId} and ${mediaObjects.usage} <> 'CATALOG_ARTWORK'`);
    await transaction.update(jobOrders).set({ state: "CLOSED", assignedDesignerId: null, submittedAt: null, updatedAt: now }).where(eq(jobOrders.id, record.jobOrderId));
    await transaction.update(deletionRecords).set({ contentPurgedAt: now }).where(eq(deletionRecords.id, record.id));
    await transaction.insert(auditEvents).values({ actorAccountId: record.requestedBy, action: "invitation.personal_content_purged", entityType: "job_order", entityId: record.jobOrderId, metadata: { deletionRecordId: record.id } });
  });
}
