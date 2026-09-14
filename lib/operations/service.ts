import "server-only";

import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, backgroundJobs } from "@/db/schema";
import type { Actor } from "@/lib/auth/permissions";

export class OperationsAuthorizationError extends Error {}
export class OperationsConflictError extends Error {}

export async function getOperationsDashboard(actor: Actor) {
  if (actor.accountType !== "STAFF" || !actor.roles.includes("ADMIN")) throw new OperationsAuthorizationError("Admin permission required");
  const db = getDb();
  const queues = await db.execute<{ key: string; total: number }>(sql`
    select key, total::int from (
      select 'waiting_content' key, count(*) total from job_orders where state in ('NEW', 'COLLECTING')
      union all select 'ready', count(*) from job_orders where state = 'READY'
      union all select 'in_design', count(*) from job_orders where state = 'IN_PRODUCTION'
      union all select 'waiting_review', count(*) from invitation_drafts where review_state = 'IN_REVIEW'
      union all select 'changes_requested', count(*) from invitation_drafts where review_state = 'CHANGES_REQUESTED'
      union all select 'approved_unpublished', count(*) from invitation_drafts draft join invitations invitation on invitation.id = draft.invitation_id where draft.review_state = 'APPROVED' and invitation.availability = 'UNPUBLISHED'
      union all select 'due_next_7_days', count(*) from job_orders where due_date between current_date and current_date + 7 and state not in ('CLOSED', 'CANCELLED')
    ) queue order by key
  `);
  const failedJobs = await db.execute<{ id: string; kind: string; attempts: number; lastErrorCode: string | null; availableAt: Date }>(sql`
    select id, kind, attempts, last_error_code as "lastErrorCode", available_at as "availableAt"
    from background_jobs where state = 'FAILED' order by completed_at desc nulls last limit 25
  `);
  const backupSummary = await db.execute<{ state: string; total: number }>(sql`
    select state::text, count(*)::int total from media_backups group by state order by state
  `);
  const notificationSummary = await db.execute<{ state: string; total: number }>(sql`
    select state::text, count(*)::int total from notification_deliveries group by state order by state
  `);
  const overdueOrders = await db.execute<{ id: string; jobNumber: string; state: string; dueDate: string; customerName: string }>(sql`
    select jo.id, jo.job_number as "jobNumber", jo.state::text, jo.due_date::text as "dueDate", account.display_name as "customerName"
    from job_orders jo join accounts account on account.id = jo.customer_id
    where jo.due_date < current_date and jo.state not in ('DELIVERED', 'CLOSED', 'CANCELLED')
    order by jo.due_date limit 25
  `);
  return { generatedAt: new Date().toISOString(), queues, failedJobs, backupSummary, notificationSummary, overdueOrders };
}

export async function retryFailedJob(actor: Actor, jobId: string) {
  if (actor.accountType !== "STAFF" || !actor.roles.includes("ADMIN")) throw new OperationsAuthorizationError("Admin permission required");
  const [job] = await getDb().transaction(async (transaction) => {
    const rows = await transaction.update(backgroundJobs).set({ state: "PENDING", attempts: 0, availableAt: new Date(), leasedUntil: null, completedAt: null, lastErrorCode: null })
      .where(sql`${backgroundJobs.id} = ${jobId}::uuid and ${backgroundJobs.state} = 'FAILED'`).returning({ id: backgroundJobs.id, kind: backgroundJobs.kind });
    if (rows[0]) await transaction.insert(auditEvents).values({ actorAccountId: actor.accountId, action: "background_job.retried", entityType: "background_job", entityId: rows[0].id, metadata: { kind: rows[0].kind } });
    return rows;
  });
  if (!job) throw new OperationsConflictError("Only a failed task can be retried");
  return job;
}
