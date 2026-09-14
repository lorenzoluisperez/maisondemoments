import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, eventBriefs, jobOrders, paymentEntries } from "@/db/schema";
import type { Actor } from "@/lib/auth/permissions";
import { recordPaymentSchema, reversePaymentSchema } from "@/lib/payments/contracts";

export class PaymentAuthorizationError extends Error {}
export class PaymentConflictError extends Error {}
export class PaymentNotFoundError extends Error {}

const idSchema = z.string().uuid();

export async function listPayments(actor: Actor, orderId: string) {
  requireAdmin(actor);
  const id = idSchema.parse(orderId);
  const db = getDb();
  const [order] = await db.select({
    id: jobOrders.id, jobNumber: jobOrders.jobNumber, currency: jobOrders.currency,
    quotedAmountMinor: jobOrders.quotedAmountMinor, depositRequiredMinor: jobOrders.depositRequiredMinor,
  }).from(jobOrders).where(eq(jobOrders.id, id)).limit(1);
  if (!order) throw new PaymentNotFoundError("Job order not found");
  const entries = await db.select({
    id: paymentEntries.id, amountMinor: paymentEntries.amountMinor, currency: paymentEntries.currency,
    method: paymentEntries.method, externalReference: paymentEntries.externalReference, note: paymentEntries.note,
    reversalOfId: paymentEntries.reversalOfId, confirmedAt: paymentEntries.confirmedAt,
  }).from(paymentEntries).where(eq(paymentEntries.jobOrderId, id)).orderBy(desc(paymentEntries.confirmedAt));
  const paidAmountMinor = entries.reduce((sum, entry) => sum + entry.amountMinor, 0);
  const reversedIds = new Set(entries.flatMap((entry) => entry.reversalOfId ? [entry.reversalOfId] : []));
  return {
    order,
    paidAmountMinor,
    outstandingAmountMinor: Math.max(0, order.quotedAmountMinor - paidAmountMinor),
    depositOutstandingMinor: Math.max(0, order.depositRequiredMinor - paidAmountMinor),
    entries: entries.map((entry) => ({ ...entry, reversible: entry.amountMinor > 0 && !reversedIds.has(entry.id) })),
  };
}

export async function recordPayment(actor: Actor, orderId: string, input: unknown) {
  requireAdmin(actor);
  const id = idSchema.parse(orderId);
  const parsed = recordPaymentSchema.parse(input);
  const db = getDb();
  try {
    await db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
      const [order] = await transaction.select().from(jobOrders).where(eq(jobOrders.id, id)).limit(1);
      if (!order) throw new PaymentNotFoundError("Job order not found");
      const [existing] = await transaction.select({ id: paymentEntries.id }).from(paymentEntries)
        .where(eq(paymentEntries.idempotencyKey, parsed.idempotencyKey)).limit(1);
      if (existing) return;
      const [total] = await transaction.select({ amount: sql<number>`coalesce(sum(${paymentEntries.amountMinor}), 0)::bigint` })
        .from(paymentEntries).where(eq(paymentEntries.jobOrderId, id));
      if (Number(total?.amount ?? 0) + parsed.amountMinor > order.quotedAmountMinor) {
        throw new PaymentConflictError("Payment exceeds the order balance");
      }
      const [entry] = await transaction.insert(paymentEntries).values({
        jobOrderId: id, amountMinor: parsed.amountMinor, currency: order.currency, method: parsed.method,
        externalReference: parsed.externalReference, note: parsed.note, confirmedBy: actor.accountId,
        idempotencyKey: parsed.idempotencyKey,
      }).returning({ id: paymentEntries.id });
      const nextPaid = Number(total?.amount ?? 0) + parsed.amountMinor;
      if (order.state === "COLLECTING" && nextPaid >= order.depositRequiredMinor) {
        const [brief] = await transaction.select({ submittedAt: eventBriefs.submittedAt }).from(eventBriefs)
          .where(eq(eventBriefs.jobOrderId, id)).limit(1);
        if (brief?.submittedAt && order.assignedDesignerId) await transaction.update(jobOrders)
          .set({ state: "READY", updatedAt: new Date() }).where(eq(jobOrders.id, id));
      }
      await transaction.insert(auditEvents).values({
        actorAccountId: actor.accountId, action: "payment.recorded", entityType: "payment_entry", entityId: entry.id,
        metadata: { jobOrderId: id, amountMinor: parsed.amountMinor, currency: order.currency, method: parsed.method },
      });
    });
  } catch (error) {
    if (error instanceof PaymentConflictError || error instanceof PaymentNotFoundError) throw error;
    const message = databaseErrorText(error);
    if (message.includes("payment_external_reference_unique")) throw new PaymentConflictError("This payment reference has already been recorded");
    throw error;
  }
  return listPayments(actor, id);
}

export async function reversePayment(actor: Actor, orderId: string, paymentId: string, input: unknown) {
  requireAdmin(actor);
  const id = idSchema.parse(orderId);
  const targetId = idSchema.parse(paymentId);
  const parsed = reversePaymentSchema.parse(input);
  const db = getDb();
  try {
    await db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
      const [existing] = await transaction.select({ id: paymentEntries.id }).from(paymentEntries)
        .where(eq(paymentEntries.idempotencyKey, parsed.idempotencyKey)).limit(1);
      if (existing) return;
      const [original] = await transaction.select().from(paymentEntries).where(eq(paymentEntries.id, targetId)).limit(1);
      if (!original || original.jobOrderId !== id) throw new PaymentNotFoundError("Payment receipt not found");
      if (original.reversalOfId || original.amountMinor <= 0) throw new PaymentConflictError("Only an original receipt can be reversed");
      const [reversal] = await transaction.insert(paymentEntries).values({
        jobOrderId: id, amountMinor: -original.amountMinor, currency: original.currency, method: original.method,
        externalReference: undefined, note: parsed.reason, confirmedBy: actor.accountId, reversalOfId: original.id,
        idempotencyKey: parsed.idempotencyKey,
      }).returning({ id: paymentEntries.id });
      await transaction.insert(auditEvents).values({
        actorAccountId: actor.accountId, action: "payment.reversed", entityType: "payment_entry", entityId: reversal.id,
        metadata: { jobOrderId: id, originalPaymentId: original.id, amountMinor: -original.amountMinor, reason: parsed.reason },
      });
    });
  } catch (error) {
    if (error instanceof PaymentConflictError || error instanceof PaymentNotFoundError) throw error;
    const message = databaseErrorText(error);
    if (message.includes("payment_reversal_unique") || message.includes("duplicate key")) throw new PaymentConflictError("This payment has already been reversed");
    throw error;
  }
  return listPayments(actor, id);
}

function requireAdmin(actor: Actor) {
  if (actor.accountType !== "STAFF" || !actor.roles.includes("ADMIN")) throw new PaymentAuthorizationError("Admin permission required");
}

function databaseErrorText(error: unknown) {
  if (!(error instanceof Error)) return "";
  const cause = (error as Error & { cause?: unknown }).cause;
  return `${error.message} ${cause instanceof Error ? cause.message : ""}`;
}
