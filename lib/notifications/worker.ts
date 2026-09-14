import "server-only";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { backgroundJobs, notificationDeliveries } from "@/db/schema";

const payloadSchema = z.object({ deliveryId: z.string().uuid() }).strict();

export async function runNotificationWorker(workerId: string, limit = 4) {
  const jobs = await getDb().execute<{ id: string; payload: unknown; attempts: number }>(sql`
    select id, payload, attempts from claim_background_jobs('SEND_EMAIL', ${Math.max(1, Math.min(limit, 8))}, 120)
  `);
  const results = [];
  for (const job of jobs) {
    try {
      const { deliveryId } = payloadSchema.parse(job.payload);
      await sendDelivery(deliveryId);
      await getDb().update(backgroundJobs).set({ state: "SUCCEEDED", leasedUntil: null, completedAt: new Date(), lastErrorCode: null }).where(eq(backgroundJobs.id, job.id));
      results.push({ jobId: job.id, outcome: "SENT" });
    } catch (error) {
      const failed = job.attempts >= 5;
      const code = safeCode(error);
      await getDb().update(backgroundJobs).set({ state: failed ? "FAILED" : "PENDING", leasedUntil: null, completedAt: failed ? new Date() : null, availableAt: failed ? new Date() : new Date(Date.now() + Math.min(2 ** job.attempts, 30) * 60_000), lastErrorCode: code }).where(eq(backgroundJobs.id, job.id));
      const payload = payloadSchema.safeParse(job.payload);
      if (payload.success) await getDb().update(notificationDeliveries).set({ state: failed ? "FAILED" : "PENDING", lastErrorCode: code, updatedAt: new Date() }).where(eq(notificationDeliveries.id, payload.data.deliveryId));
      results.push({ jobId: job.id, outcome: failed ? "FAILED" : "RETRY_SCHEDULED", errorCode: code });
    }
  }
  return { workerId, claimed: jobs.length, results };
}

async function sendDelivery(deliveryId: string) {
  const db = getDb();
  const [delivery] = await db.select().from(notificationDeliveries).where(eq(notificationDeliveries.id, deliveryId)).limit(1);
  if (!delivery) throw new Error("NOTIFICATION_NOT_FOUND");
  if (delivery.state === "SENT") return;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!apiKey || !from || !appUrl) throw new Error("EMAIL_NOT_CONFIGURED");
  const content = template(delivery.kind, delivery.payload as Record<string, unknown>, appUrl);
  await db.update(notificationDeliveries).set({ state: "SENDING", attempts: delivery.attempts + 1, updatedAt: new Date() }).where(eq(notificationDeliveries.id, delivery.id));
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": delivery.idempotencyKey },
    body: JSON.stringify({ from, to: [delivery.recipient], subject: content.subject, text: content.text }),
  });
  const body = await response.json() as { id?: string };
  if (!response.ok || !body.id) throw new Error("EMAIL_PROVIDER_ERROR");
  await db.update(notificationDeliveries).set({ state: "SENT", providerMessageId: body.id, sentAt: new Date(), lastErrorCode: null, updatedAt: new Date() }).where(eq(notificationDeliveries.id, delivery.id));
}

function template(kind: string, payload: Record<string, unknown>, appUrl: string) {
  const jobNumber = typeof payload.jobNumber === "string" ? payload.jobNumber : "your invitation";
  if (kind === "REVIEW_READY") return { subject: `${jobNumber} is ready for review`, text: `Your invitation review is ready. Sign in at ${appUrl}/portal to review the exact version and approve it or submit one consolidated change request.` };
  if (kind === "INVITATION_PUBLISHED") return { subject: `${jobNumber} has been published`, text: `Your approved invitation is live. Sign in at ${appUrl}/portal to manage household links and responses.` };
  throw new Error("UNKNOWN_NOTIFICATION_KIND");
}

function safeCode(error: unknown) {
  const message = error instanceof Error ? error.message : "EMAIL_DELIVERY_ERROR";
  return /^[A-Z0-9_]{3,80}$/.test(message) ? message : "EMAIL_DELIVERY_ERROR";
}
