import { randomUUID, timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { enqueueMissingMediaBackups, runBackupWorker } from "@/lib/backup/worker";
import { cleanupMediaStorage, runMediaWorker } from "@/lib/media/worker";
import { runNotificationWorker } from "@/lib/notifications/worker";
import { operationalLog } from "@/lib/operations/logger";
import { runRetentionSweep } from "@/lib/operations/retention";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const configured = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied || !safeEqual(configured, supplied)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const runId = randomUUID(); const started = Date.now();
  operationalLog("info", "operations.run.started", { runId });
  try {
    const media = await runMediaWorker(`cron:${runId}`, 2);
    const queuedBackups = await enqueueMissingMediaBackups();
    const backups = await runBackupWorker(`cron:${runId}`, 2);
    const notifications = await runNotificationWorker(`cron:${runId}`, 4);
    const retention = await runRetentionSweep();
    const cleanup = await cleanupMediaStorage();
    operationalLog("info", "operations.run.completed", { runId, durationMs: Date.now() - started, mediaClaimed: media.claimed, backupClaimed: backups.claimed, emailClaimed: notifications.claimed, deletionCount: retention.purged.length });
    return NextResponse.json({ runId, media, queuedBackups, backups, notifications, retention, cleanup });
  } catch (error) {
    Sentry.captureException(error, { tags: { surface: "operations-cron", runId } });
    operationalLog("error", "operations.run.failed", { runId, durationMs: Date.now() - started, errorCode: error instanceof Error && /^[A-Z0-9_]{3,80}$/.test(error.message) ? error.message : "OPERATIONS_RUN_FAILED" });
    return NextResponse.json({ error: "Operations run failed", runId }, { status: 500 });
  }
}

function safeEqual(expected: string, supplied: string) {
  const left = Buffer.from(expected); const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}
