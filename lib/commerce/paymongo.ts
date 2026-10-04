import "server-only";

import { and, desc, eq, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, checkoutAttempts, invitations, paymentEntries, purchases } from "@/db/schema";
import type { Actor } from "@/lib/auth/permissions";
import { CommerceConflictError, getCustomerPurchase } from "@/lib/commerce/purchases";
import { weddingProduct } from "@/lib/products/catalog";
import { verifyPaymongoSignatureBody } from "@/lib/commerce/signature";
import { isConfirmedFullRefund, type ProviderRefund } from "@/lib/commerce/refund-verification";
import { recordCommerceMetric, type CommerceMetricTier } from "@/lib/commerce/metrics";
import { showcaseOnly } from "@/lib/site-mode";

function credentials() {
  const key = process.env.PAYMONGO_SECRET_KEY;
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!key || !secret) throw new CommerceConflictError("Payments are not configured");
  if (process.env.NODE_ENV !== "production" && key.startsWith("sk_live_")) {
    throw new CommerceConflictError("Live PayMongo payments are disabled in local development");
  }
  return { key, secret, live: key.startsWith("sk_live_") };
}

export function verifyPaymongoSignature(body: string, header: string | null) {
  const { secret, live } = credentials();
  return verifyPaymongoSignatureBody(body, header, secret, live);
}

type ProviderSession = {
  data?: { id?: string; attributes?: { checkout_url?: string; livemode?: boolean } };
};

export async function createOrReuseCheckout(actor: Actor, purchaseId: string) {
  if (showcaseOnly) throw new CommerceConflictError("Online checkout is paused. Please contact us on Facebook or Instagram");
  const purchase = await getCustomerPurchase(actor, purchaseId);
  if (purchase.status !== "AWAITING_PAYMENT") throw new CommerceConflictError("This purchase is no longer awaiting payment");
  if (!(purchase.termsSnapshot as { acceptedAt?: unknown } | null)?.acceptedAt) throw new CommerceConflictError("Service terms must be accepted before payment");
  const { key, live } = credentials();
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${purchaseId}, 0))`);
    const [current] = await tx.select().from(purchases).where(eq(purchases.id, purchaseId)).limit(1);
    if (current?.status !== "AWAITING_PAYMENT") throw new CommerceConflictError("This purchase is no longer awaiting payment");
    const [existing] = await tx.select().from(checkoutAttempts).where(and(eq(checkoutAttempts.purchaseId, purchaseId), sql`${checkoutAttempts.state} IN ('CREATING', 'OPEN')`)).orderBy(desc(checkoutAttempts.createdAt)).limit(1);
    if (existing) {
      if (existing.state === "CREATING" && Date.now() - existing.updatedAt.getTime() > 60_000) {
        if (Date.now() - existing.createdAt.getTime() > 23 * 60 * 60_000) {
          throw new CommerceConflictError("Checkout needs staff review before another payment page can be created");
        }
        const [leased] = await tx.update(checkoutAttempts).set({ updatedAt: new Date() }).where(eq(checkoutAttempts.id, existing.id)).returning();
        return { attempt: leased, mayCreate: true, firstAttempt: false };
      }
      return { attempt: existing, mayCreate: false, firstAttempt: false };
    }
    const [priorAttempt] = await tx.select({ id: checkoutAttempts.id }).from(checkoutAttempts).where(eq(checkoutAttempts.purchaseId, purchaseId)).limit(1);
    const id = crypto.randomUUID();
    const [created] = await tx.insert(checkoutAttempts).values({
      id, purchaseId, reference: `MDM-${id}`, amountMinor: current.priceMinor, currency: current.currency,
    }).returning();
    return { attempt: created, mayCreate: true, firstAttempt: !priorAttempt };
  });
  if (result.firstAttempt) await recordCommerceMetric(purchase.productSlug, purchase.tier as CommerceMetricTier, "CHECKOUT_STARTED");
  const attempt = result.attempt;
  if (attempt.checkoutUrl) return attempt.checkoutUrl;
  if (attempt.state !== "CREATING" || !result.mayCreate) throw new CommerceConflictError("Checkout is being prepared. Please retry in a moment.");
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) throw new CommerceConflictError("Checkout URL is not configured");
  const response = await fetch("https://api.paymongo.com/v2/checkout_sessions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `mdm-checkout-${attempt.id}`,
    },
    body: JSON.stringify({ data: { attributes: {
      line_items: [{ name: `${weddingProduct(purchase.productSlug)?.name ?? "Wedding invitation"} · ${purchase.tier}`, amount: attempt.amountMinor, currency: "PHP", quantity: 1 }],
      payment_method_types: (process.env.PAYMONGO_PAYMENT_METHODS ?? "qrph").split(","),
      success_url: `${base}/checkout/return?purchase=${purchase.id}`,
      cancel_url: `${base}/checkout?purchase=${purchase.id}`,
      reference_number: attempt.reference,
      send_email_receipt: true,
      metadata: { purchase_id: purchase.id },
    } } }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    if ([400, 401, 403, 404, 422].includes(response.status)) {
      await db.update(checkoutAttempts).set({ state: "FAILED", updatedAt: new Date() })
        .where(and(eq(checkoutAttempts.id, attempt.id), eq(checkoutAttempts.state, "CREATING")));
    }
    throw new CommerceConflictError("The payment page could not be prepared. Please try again.");
  }
  const payload = await response.json() as ProviderSession;
  const id = payload.data?.id;
  const url = payload.data?.attributes?.checkout_url;
  if (!id?.startsWith("cs_") || !url || new URL(url).hostname !== "checkout.paymongo.com" || payload.data?.attributes?.livemode !== live) {
    throw new CommerceConflictError("The payment provider returned an invalid checkout page");
  }
  await db.update(checkoutAttempts).set({ providerSessionId: id, checkoutUrl: url, state: "OPEN", updatedAt: new Date() }).where(eq(checkoutAttempts.id, attempt.id));
  return url;
}

export type CheckoutPaidEvent = {
  data?: { type?: string; livemode?: boolean; attributes?: { type?: string; livemode?: boolean; data?: {
    id?: string; attributes?: {
      reference_number?: string;
      payments?: Array<{ id?: string; attributes?: { amount?: number; currency?: string; status?: string } }>;
    };
  } }; data?: {
    id?: string; attributes?: {
      reference_number?: string;
      payments?: Array<{ id?: string; attributes?: { amount?: number; currency?: string; status?: string } }>;
    };
  } };
};

export async function applyPaymongoPaidEvent(event: CheckoutPaidEvent) {
  const kind = event.data?.attributes?.type ?? event.data?.type;
  if (kind !== "checkout_session.payment.paid") return false;
  const session = event.data?.attributes?.data ?? event.data?.data;
  const paidPayments = session?.attributes?.payments?.filter((payment) => payment.attributes?.status === "paid") ?? [];
  const { live } = credentials();
  if ((event.data?.attributes?.livemode ?? event.data?.livemode) !== live || !session?.id || !session.attributes?.reference_number || paidPayments.length !== 1) throw new CommerceConflictError("Payment event did not match the expected mode or shape");
  const paid = paidPayments[0];
  if (!paid.id || !Number.isSafeInteger(paid.attributes?.amount)) throw new CommerceConflictError("Payment event is incomplete");
  const db = getDb();
  const settlement = await db.transaction(async (tx) => {
    const [attempt] = await tx.select().from(checkoutAttempts).where(eq(checkoutAttempts.reference, session.attributes!.reference_number!)).limit(1);
    if (!attempt || attempt.providerSessionId !== session.id) throw new CommerceConflictError("Payment session does not match an attempt");
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${attempt.purchaseId}, 0))`);
    const [purchase] = await tx.select().from(purchases).where(eq(purchases.id, attempt.purchaseId)).limit(1);
    if (!purchase || attempt.amountMinor !== paid.attributes!.amount || purchase.priceMinor !== paid.attributes!.amount ||
        attempt.currency !== "PHP" || paid.attributes?.currency !== "PHP") throw new CommerceConflictError("Payment amount or currency does not match the purchase");
    if (["PAID", "ORDER_CREATED", "REFUNDED"].includes(purchase.status)) {
      if (attempt.providerPaymentId === paid.id) return { newlySettled: false, productSlug: purchase.productSlug, tier: purchase.tier };
      throw new CommerceConflictError("A different payment already settled this purchase");
    }
    if (purchase.status !== "AWAITING_PAYMENT") throw new CommerceConflictError("Purchase can no longer be settled");
    await tx.update(checkoutAttempts).set({ state: "PAID", providerPaymentId: paid.id, updatedAt: new Date() }).where(eq(checkoutAttempts.id, attempt.id));
    await tx.update(purchases).set({ status: "PAID", paidAt: new Date(), updatedAt: new Date() }).where(eq(purchases.id, purchase.id));
    return { newlySettled: true, productSlug: purchase.productSlug, tier: purchase.tier };
  });
  if (settlement.newlySettled) await recordCommerceMetric(settlement.productSlug, settlement.tier as CommerceMetricTier, "PAID");
  return true;
}

export async function reconcilePaymongoCheckouts(limit = 8) {
  if (!process.env.PAYMONGO_SECRET_KEY || !process.env.PAYMONGO_WEBHOOK_SECRET) return { inspected: 0, settled: 0, expired: 0, errors: 0 };
  const { key } = credentials();
  const db = getDb();
  const pending = await db.select().from(checkoutAttempts).where(and(
    eq(checkoutAttempts.state, "OPEN"),
    lt(checkoutAttempts.updatedAt, new Date(Date.now() - 2 * 60_000)),
  )).orderBy(checkoutAttempts.updatedAt).limit(limit);
  const result = { inspected: pending.length, settled: 0, expired: 0, errors: 0 };
  for (const attempt of pending) {
    if (!attempt.providerSessionId) { result.errors += 1; continue; }
    try {
      const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(attempt.providerSessionId)}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
        cache: "no-store", signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("Provider session lookup failed");
      const payload = await response.json() as { data?: { id?: string; attributes?: { livemode?: boolean; status?: string; reference_number?: string; payments?: Array<{ id?: string; attributes?: { status?: string; amount?: number; currency?: string } }> } } };
      const session = payload.data;
      if (session?.id !== attempt.providerSessionId || session.attributes?.reference_number !== attempt.reference) throw new Error("Provider session identity mismatch");
      if (session.attributes.payments?.some((payment) => payment.attributes?.status === "paid")) {
        await applyPaymongoPaidEvent({ data: { type: "checkout_session.payment.paid", livemode: session.attributes.livemode, data: session } });
        result.settled += 1;
      } else if (session.attributes.status === "expired") {
        await db.update(checkoutAttempts).set({ state: "EXPIRED", updatedAt: new Date() }).where(and(eq(checkoutAttempts.id, attempt.id), eq(checkoutAttempts.state, "OPEN")));
        result.expired += 1;
      }
    } catch { result.errors += 1; }
  }
  return result;
}

export async function confirmPaymongoFullRefund(actor: Actor, purchaseId: string, refundId: string) {
  if (actor.accountType !== "STAFF" || !actor.roles.includes("ADMIN")) throw new CommerceConflictError("Admin access required");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(purchaseId) || !/^ref_[a-zA-Z0-9]{8,80}$/.test(refundId)) {
    throw new CommerceConflictError("Enter a valid purchase and PayMongo refund reference");
  }
  const { key, live } = credentials();
  const response = await fetch(`https://api.paymongo.com/v1/refunds/${encodeURIComponent(refundId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
    cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new CommerceConflictError("PayMongo could not confirm this refund");
  const payload = await response.json() as { data?: ProviderRefund };
  const refund = payload.data;
  const recorded = await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${purchaseId}, 0))`);
    const [purchase] = await tx.select().from(purchases).where(eq(purchases.id, purchaseId)).limit(1);
    const [attempt] = await tx.select().from(checkoutAttempts).where(and(eq(checkoutAttempts.purchaseId, purchaseId), eq(checkoutAttempts.state, "PAID"))).limit(1);
    if (!purchase || !attempt?.providerPaymentId || purchase.currency !== "PHP" || !isConfirmedFullRefund(refund, {
      refundId, paymentId: attempt.providerPaymentId, amountMinor: purchase.priceMinor, currency: purchase.currency, live,
    })) throw new CommerceConflictError("PayMongo has not confirmed a full refund for this exact purchase");
    if (purchase.status === "REFUNDED") return { status: "REFUNDED", purchaseId, newlyRefunded: false, productSlug: purchase.productSlug, tier: purchase.tier };
    if (!["PAID", "ORDER_CREATED"].includes(purchase.status)) throw new CommerceConflictError("This purchase has no confirmed payment to refund");
    if (purchase.jobOrderId) {
      const [original] = await tx.select().from(paymentEntries).where(and(
        eq(paymentEntries.jobOrderId, purchase.jobOrderId), eq(paymentEntries.method, "PAYMONGO"),
        eq(paymentEntries.externalReference, attempt.providerPaymentId),
      )).limit(1);
      if (!original || original.amountMinor !== purchase.priceMinor || original.reversalOfId) throw new CommerceConflictError("The original provider receipt is missing");
      await tx.insert(paymentEntries).values({
        jobOrderId: purchase.jobOrderId, amountMinor: -purchase.priceMinor, currency: "PHP", method: "PAYMONGO",
        externalReference: refundId, confirmedBy: null, reversalOfId: original.id,
        idempotencyKey: crypto.randomUUID(), note: "Provider-confirmed full refund",
      });
      const [liveInvitation] = await tx.update(invitations).set({
        availability: "SUSPENDED", accessEpoch: sql`${invitations.accessEpoch} + 1`, updatedAt: new Date(),
      }).where(and(eq(invitations.jobOrderId, purchase.jobOrderId), eq(invitations.availability, "LIVE")))
        .returning({ id: invitations.id });
      if (liveInvitation) await tx.insert(auditEvents).values({
        actorAccountId: actor.accountId, action: "invitation.suspended", entityType: "invitation", entityId: liveInvitation.id,
        metadata: { reason: "Full provider-confirmed refund", providerRefundId: refundId },
      });
    }
    await tx.update(purchases).set({ status: "REFUNDED", updatedAt: new Date() }).where(eq(purchases.id, purchaseId));
    await tx.insert(auditEvents).values({
      actorAccountId: actor.accountId, action: "payment.refund_confirmed", entityType: "purchase", entityId: purchaseId,
      metadata: { providerRefundId: refundId, providerPaymentId: attempt.providerPaymentId, amountMinor: purchase.priceMinor },
    });
    return { status: "REFUNDED", purchaseId, newlyRefunded: true, productSlug: purchase.productSlug, tier: purchase.tier };
  });
  if (recorded.newlyRefunded) await recordCommerceMetric(recorded.productSlug, recorded.tier as CommerceMetricTier, "REFUNDED");
  return { status: recorded.status, purchaseId: recorded.purchaseId };
}
