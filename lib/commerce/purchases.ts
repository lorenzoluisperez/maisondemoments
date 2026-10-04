import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, auditEvents, checkoutAttempts, commerceDailyMetrics, coutureQuotes, eventBriefs, invitationDrafts, invitations, jobOrders, paymentEntries, productOffers, productionCostEntries, purchases, packages, staffMemberships } from "@/db/schema";
import type { Actor } from "@/lib/auth/permissions";
import { completeEventFromBrief, eventBriefDocumentSchema, type EventBriefDocument } from "@/lib/content/brief";
import { submitEventBrief } from "@/lib/content/service";
import { offerUpdateSchema, purchaseInputSchema, quoteOfferSchema, quoteRequestSchema } from "@/lib/commerce/contracts";
import { recordCommerceMetric } from "@/lib/commerce/metrics";
import { createJobOrder } from "@/lib/orders/service";
import { standardTerms, weddingProduct } from "@/lib/products/catalog";
import { emptyWeddingDetails } from "@/lib/products/content";
import { weddingProductBriefIssues } from "@/lib/products/validation";
import { showcaseOnly } from "@/lib/site-mode";

export class CommerceError extends Error {}
export class CommerceForbiddenError extends CommerceError {}
export class CommerceConflictError extends CommerceError {}

function customer(actor: Actor) {
  if (actor.accountType !== "CUSTOMER") throw new CommerceForbiddenError("Customer account required");
}
function admin(actor: Actor) {
  if (actor.accountType !== "STAFF" || !actor.roles.includes("ADMIN")) throw new CommerceForbiddenError("Admin access required");
}
export function commerceReady() {
  if (showcaseOnly) return false;
  const secureUrl = (value: string | undefined, allowLocal = false) => {
    try {
      const url = new URL(value ?? "");
      return url.protocol === "https:" || (allowLocal && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
    } catch { return false; }
  };
  return process.env.COMMERCE_CHECKOUT_ENABLED === "true" &&
    process.env.COMMERCE_ANALYTICS_ENABLED === "true" &&
    Boolean(process.env.PAYMONGO_SECRET_KEY?.match(/^sk_(test|live)_/)) &&
    (process.env.NODE_ENV === "production" || !process.env.PAYMONGO_SECRET_KEY?.startsWith("sk_live_")) &&
    Boolean(process.env.PAYMONGO_WEBHOOK_SECRET) &&
    secureUrl(process.env.COMMERCE_TERMS_URL) && secureUrl(process.env.COMMERCE_CANCELLATION_URL) &&
    Boolean(process.env.COMMERCE_TAX_NOTICE?.trim()) && secureUrl(process.env.NEXT_PUBLIC_APP_URL, true);
}

export async function createPurchase(actor: Actor, input: unknown) {
  customer(actor);
  const parsed = purchaseInputSchema.parse(input);
  if (!commerceReady()) throw new CommerceConflictError("Checkout is not available yet");
  if (parsed.eventDate < new Date().toISOString().slice(0, 10)) throw new CommerceConflictError("Event date must be in the future");
  const db = getDb();
  return db.transaction(async (tx) => {
    const [offer] = await tx.select().from(productOffers).where(and(
      eq(productOffers.productSlug, parsed.productSlug),
      eq(productOffers.tier, parsed.tier),
      eq(productOffers.enabled, true),
    )).limit(1);
    if (!offer?.priceMinor || !offer.turnaroundDays) throw new CommerceConflictError("This package is not available for purchase");
    const [purchase] = await tx.insert(purchases).values({
      customerId: actor.accountId,
      productSlug: parsed.productSlug,
      tier: parsed.tier,
      eventDate: parsed.eventDate,
      timezone: parsed.timezone,
      contactName: parsed.contactName,
      priceMinor: offer.priceMinor,
      termsSnapshot: {
        ...standardTerms,
        designName: weddingProduct(parsed.productSlug)?.name,
        productSlug: parsed.productSlug,
        tier: parsed.tier,
        priceMinor: offer.priceMinor,
        currency: "PHP",
        turnaroundDays: offer.turnaroundDays,
        termsUrl: process.env.COMMERCE_TERMS_URL,
        cancellationUrl: process.env.COMMERCE_CANCELLATION_URL,
        taxNotice: process.env.COMMERCE_TAX_NOTICE,
        acceptedAt: new Date().toISOString(),
      },
    }).returning();
    return purchase;
  });
}

export async function listCustomerPurchases(actor: Actor) {
  customer(actor);
  return getDb().select().from(purchases).where(eq(purchases.customerId, actor.accountId)).orderBy(desc(purchases.createdAt));
}

function initialBrief(purchase: typeof purchases.$inferSelect): EventBriefDocument {
  return eventBriefDocumentSchema.parse({
    schemaVersion: 1,
    event: {
      id: crypto.randomUUID(), type: "wedding", timezone: purchase.timezone,
      primaryLocalDate: purchase.eventDate, rsvpDeadline: "", hostWording: "",
      partners: [{ displayName: "", roleLabel: "Partner" }, { displayName: "", roleLabel: "Partner" }],
      activities: [], participants: [], story: "", dressCode: "", giftInformation: "",
    },
    gallery: [],
    weddingDetails: emptyWeddingDetails,
  });
}

export async function getPurchaseBrief(actor: Actor, id: string) {
  const purchase = await getCustomerPurchase(actor, id);
  if (purchase.status !== "PAID" && purchase.status !== "ORDER_CREATED") throw new CommerceConflictError("Payment must be confirmed before editing your invitation");
  if (purchase.status === "ORDER_CREATED") return { purchase, document: null, revision: purchase.briefRevision, issues: [] };
  let brief = purchase.brief;
  if (!brief) {
    const created = initialBrief(purchase);
    const [updated] = await getDb().update(purchases).set({ brief: created, updatedAt: new Date() })
      .where(and(eq(purchases.id, id), sql`${purchases.brief} IS NULL`)).returning();
    brief = updated?.brief ?? (await getCustomerPurchase(actor, id)).brief;
  }
  const document = eventBriefDocumentSchema.parse(brief);
  const completed = completeEventFromBrief(document);
  return { purchase, document, revision: purchase.briefRevision, issues: [...(completed.ready ? [] : completed.issues), ...weddingProductBriefIssues(document)] };
}

export async function savePurchaseBrief(actor: Actor, id: string, input: unknown) {
  const parsed = eventBriefDocumentSchema.parse((input as { document?: unknown })?.document);
  const expectedRevision = Number((input as { expectedRevision?: unknown })?.expectedRevision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw new CommerceConflictError("Invalid brief revision");
  const current = await getCustomerPurchase(actor, id);
  if (current.status !== "PAID") throw new CommerceConflictError("This brief is no longer editable here");
  if (parsed.event.primaryLocalDate !== current.eventDate || parsed.event.timezone !== current.timezone) throw new CommerceConflictError("Contact the team to change the booked event date or timezone");
  const original = eventBriefDocumentSchema.parse(current.brief);
  if (parsed.event.type !== "wedding" || parsed.event.id !== original.event.id || parsed.gallery.length) throw new CommerceConflictError("Wedding identity or photos cannot be changed here");
  const [updated] = await getDb().update(purchases).set({
    brief: parsed, briefRevision: sql`${purchases.briefRevision} + 1`, updatedAt: new Date(),
  }).where(and(eq(purchases.id, id), eq(purchases.customerId, actor.accountId), eq(purchases.status, "PAID"), eq(purchases.briefRevision, expectedRevision))).returning();
  if (!updated) throw new CommerceConflictError("A newer copy of this brief was saved elsewhere");
  const completed = completeEventFromBrief(parsed);
  return { purchase: updated, document: parsed, revision: updated.briefRevision, issues: [...(completed.ready ? [] : completed.issues), ...weddingProductBriefIssues(parsed)] };
}

export async function completePaidPurchase(actor: Actor, id: string) {
  const current = await getCustomerPurchase(actor, id);
  if (current.status === "ORDER_CREATED" && current.jobOrderId) {
    const [brief] = await getDb().select({ revision: eventBriefs.revision, submittedAt: eventBriefs.submittedAt })
      .from(eventBriefs).where(eq(eventBriefs.jobOrderId, current.jobOrderId)).limit(1);
    if (brief?.revision === 1 && !brief.submittedAt) await submitEventBrief(actor, current.jobOrderId, { expectedRevision: 1 });
    return { orderId: current.jobOrderId };
  }
  if (current.status !== "PAID") throw new CommerceConflictError("Payment has not been confirmed");
  const document = eventBriefDocumentSchema.parse(current.brief);
  const result = completeEventFromBrief(document);
  if (!result.ready || weddingProductBriefIssues(document).length) throw new CommerceConflictError("Complete the wedding details before submitting");
  const [selectedPackage] = await getDb().select({ id: packages.id }).from(packages)
    .where(and(eq(packages.code, `WEDDING_${current.tier}`), eq(packages.active, true))).limit(1);
  if (!selectedPackage) throw new CommerceConflictError("The purchased package is not available");
  const order = await createJobOrder(actor, {
    customerId: actor.accountId, assignedDesignerId: null, packageId: selectedPackage.id,
    currency: "PHP", quotedAmountMinor: current.priceMinor, depositRequiredMinor: current.priceMinor,
    dueDate: null, collectionKey: current.productSlug === "coastal-romance" ? "luminous-parchment" : "midnight-garden",
    event: result.event,
  }, { paidPurchaseId: current.id });
  await submitEventBrief(actor, order.id, { expectedRevision: 1 });
  return { orderId: order.id };
}

export async function getCustomerPurchase(actor: Actor, id: string) {
  customer(actor);
  const [purchase] = await getDb().select().from(purchases).where(and(eq(purchases.id, id), eq(purchases.customerId, actor.accountId))).limit(1);
  if (!purchase) throw new CommerceForbiddenError("Purchase not found");
  return purchase;
}

export async function getCustomerPaymentConfirmation(actor: Actor, id: string) {
  const purchase = await getCustomerPurchase(actor, id);
  if (!purchase.paidAt || !["PAID", "ORDER_CREATED", "REFUNDED"].includes(purchase.status)) {
    throw new CommerceConflictError("Payment has not been confirmed");
  }
  const [attempt] = await getDb().select({ providerPaymentId: checkoutAttempts.providerPaymentId }).from(checkoutAttempts)
    .where(and(eq(checkoutAttempts.purchaseId, id), eq(checkoutAttempts.state, "PAID"))).limit(1);
  if (!attempt?.providerPaymentId) throw new CommerceConflictError("Provider payment reference is unavailable");
  return {
    purchaseId: purchase.id, designName: weddingProduct(purchase.productSlug)?.name ?? purchase.productSlug,
    tier: purchase.tier, amountMinor: purchase.priceMinor, currency: purchase.currency,
    paidAt: purchase.paidAt, providerPaymentId: attempt.providerPaymentId,
    contactName: purchase.contactName, jobOrderId: purchase.jobOrderId, refunded: purchase.status === "REFUNDED",
  };
}

export async function requestCoutureQuote(actor: Actor, input: unknown) {
  if (showcaseOnly) throw new CommerceConflictError("Please contact us on Facebook or Instagram to discuss an invitation");
  customer(actor);
  const parsed = quoteRequestSchema.parse(input);
  const [quote] = await getDb().insert(coutureQuotes).values({ customerId: actor.accountId, ...parsed }).returning();
  await recordCommerceMetric(parsed.productSlug, "COUTURE", "QUOTE_REQUESTED");
  return quote;
}

export async function listCustomerQuotes(actor: Actor) {
  customer(actor);
  return getDb().select().from(coutureQuotes).where(eq(coutureQuotes.customerId, actor.accountId)).orderBy(desc(coutureQuotes.createdAt));
}

export async function getCustomerQuote(actor: Actor, id: string) {
  customer(actor);
  const [quote] = await getDb().select().from(coutureQuotes).where(and(eq(coutureQuotes.id, id), eq(coutureQuotes.customerId, actor.accountId))).limit(1);
  if (!quote) throw new CommerceForbiddenError("Proposal not found");
  return quote;
}

export async function offerCoutureQuote(actor: Actor, id: string, input: unknown) {
  admin(actor);
  const parsed = quoteOfferSchema.parse(input);
  const [quote] = await getDb().update(coutureQuotes).set({ ...parsed, state: "OFFERED", updatedAt: new Date() })
    .where(and(eq(coutureQuotes.id, id), eq(coutureQuotes.state, "REQUESTED"))).returning();
  if (!quote) throw new CommerceConflictError("Quote cannot be offered");
  return quote;
}

export async function acceptCoutureQuote(actor: Actor, id: string, eventDate: string, timezone: string, contactName: string, acceptedTerms: true) {
  customer(actor);
  const dates = purchaseInputSchema.pick({ eventDate: true, timezone: true, contactName: true, acceptedTerms: true }).parse({ eventDate, timezone, contactName, acceptedTerms });
  if (!commerceReady()) throw new CommerceConflictError("Checkout is not available yet");
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
    const [quote] = await tx.select().from(coutureQuotes).where(and(eq(coutureQuotes.id, id), eq(coutureQuotes.customerId, actor.accountId))).limit(1);
    if (!quote || quote.state !== "OFFERED" || !quote.priceMinor || !quote.scope || !quote.exclusions || !quote.revisionRounds || !quote.deliveryDays) throw new CommerceConflictError("Quote is not ready");
    const [existing] = await tx.select().from(purchases).where(eq(purchases.quoteId, id)).limit(1);
    if (existing) return existing;
    const [purchase] = await tx.insert(purchases).values({
      customerId: actor.accountId, productSlug: quote.productSlug, tier: "COUTURE",
      quoteId: quote.id, eventDate: dates.eventDate, timezone: dates.timezone, contactName: dates.contactName, priceMinor: quote.priceMinor,
      termsSnapshot: {
        designName: weddingProduct(quote.productSlug)?.name, productSlug: quote.productSlug, tier: "COUTURE",
        priceMinor: quote.priceMinor, currency: "PHP", scope: quote.scope, exclusions: quote.exclusions,
        revisionRounds: quote.revisionRounds, turnaroundDays: quote.deliveryDays,
        termsUrl: process.env.COMMERCE_TERMS_URL, cancellationUrl: process.env.COMMERCE_CANCELLATION_URL,
        taxNotice: process.env.COMMERCE_TAX_NOTICE,
        acceptedAt: new Date().toISOString(),
      },
    }).returning();
    await tx.update(coutureQuotes).set({ state: "ACCEPTED", acceptedAt: new Date(), updatedAt: new Date() }).where(eq(coutureQuotes.id, id));
    return purchase;
  });
}

export async function listAdminCommerce(actor: Actor) {
  admin(actor);
  const db = getDb();
  const [offers, quotes, orders, attempts, designers, productionOrders, metrics, costs, tierEconomics] = await Promise.all([
    db.select().from(productOffers),
    db.select().from(coutureQuotes).orderBy(desc(coutureQuotes.createdAt)).limit(100),
    db.select().from(purchases).orderBy(desc(purchases.createdAt)).limit(100),
    db.select().from(checkoutAttempts).orderBy(desc(checkoutAttempts.createdAt)).limit(100),
    db.select({ id: accounts.id, name: accounts.displayName }).from(accounts)
      .innerJoin(staffMemberships, eq(staffMemberships.accountId, accounts.id))
      .where(and(eq(accounts.type, "STAFF"), eq(accounts.active, true), eq(staffMemberships.role, "DESIGNER"))),
    db.select({ id: jobOrders.id, assignedDesignerId: jobOrders.assignedDesignerId, state: jobOrders.state, submittedAt: jobOrders.submittedAt, reviewState: invitationDrafts.reviewState, availability: invitations.availability }).from(jobOrders)
      .leftJoin(invitations, eq(invitations.jobOrderId, jobOrders.id))
      .leftJoin(invitationDrafts, eq(invitationDrafts.invitationId, invitations.id))
      .where(sql`${jobOrders.id} IN (select job_order_id from purchases where job_order_id is not null order by created_at desc limit 100)`),
    db.select({ productSlug: commerceDailyMetrics.productSlug, tier: commerceDailyMetrics.tier, stage: commerceDailyMetrics.stage, count: sql<number>`sum(${commerceDailyMetrics.count})::integer` })
      .from(commerceDailyMetrics).where(sql`${commerceDailyMetrics.day} >= (now() at time zone 'Asia/Manila')::date - 29`)
      .groupBy(commerceDailyMetrics.productSlug, commerceDailyMetrics.tier, commerceDailyMetrics.stage),
    db.select().from(productionCostEntries).where(sql`${productionCostEntries.purchaseId} IN (select id from purchases order by created_at desc limit 100)`),
    db.execute<{ tier: string; orderCount: number; revenueMinor: number; costMinor: number; laborMinutes: number }>(sql`
      with cost_totals as (
        select purchase_id, sum(amount_minor)::bigint as amount, sum(coalesce(minutes, 0))::integer as minutes
        from production_cost_entries where voided_at is null group by purchase_id
      )
      select p.tier, count(*)::integer as "orderCount",
        coalesce(sum(case when p.status = 'REFUNDED' then 0 else p.price_minor end), 0)::bigint as "revenueMinor",
        coalesce(sum(coalesce(c.amount, 0)), 0)::bigint as "costMinor",
        coalesce(sum(coalesce(c.minutes, 0)), 0)::integer as "laborMinutes"
      from purchases p left join cost_totals c on c.purchase_id = p.id
      where p.created_at >= now() - interval '30 days' and p.status in ('PAID', 'ORDER_CREATED', 'REFUNDED')
      group by p.tier`),
  ]);
  return { offers, quotes, purchases: orders, attempts, designers, productionOrders, metrics, costs, tierEconomics, checkoutReady: commerceReady(), observedAt: new Date().toISOString() };
}

export async function assignProductionOrder(actor: Actor, orderId: string, designerId: string | null) {
  admin(actor);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) throw new CommerceConflictError("Invalid order");
  return getDb().transaction(async (tx) => {
    const [order] = await tx.select({ id: jobOrders.id, assignedDesignerId: jobOrders.assignedDesignerId, state: jobOrders.state, submittedAt: jobOrders.submittedAt, depositRequiredMinor: jobOrders.depositRequiredMinor }).from(jobOrders)
      .innerJoin(purchases, eq(purchases.jobOrderId, jobOrders.id))
      .where(eq(jobOrders.id, orderId)).for("update").limit(1);
    if (!order) throw new CommerceConflictError("Production order not found");
    if (!designerId && !["NEW", "COLLECTING", "READY"].includes(order.state)) throw new CommerceConflictError("Assign another designer before removing a production assignment");
    if (designerId) {
      const [designer] = await tx.select({ id: accounts.id }).from(accounts)
        .innerJoin(staffMemberships, eq(staffMemberships.accountId, accounts.id))
        .where(and(eq(accounts.id, designerId), eq(accounts.type, "STAFF"), eq(accounts.active, true), eq(staffMemberships.role, "DESIGNER"))).limit(1);
      if (!designer) throw new CommerceConflictError("Choose an active designer");
    }
    if (order.assignedDesignerId === designerId) return order;
    const [paid] = await tx.select({ amount: sql<number>`coalesce(sum(${paymentEntries.amountMinor}), 0)::bigint` })
      .from(paymentEntries).where(eq(paymentEntries.jobOrderId, orderId));
    const ready = Boolean(designerId && order.submittedAt && Number(paid?.amount ?? 0) >= order.depositRequiredMinor);
    const nextState = ["NEW", "COLLECTING", "READY"].includes(order.state) ? (ready ? "READY" : "COLLECTING") : order.state;
    const [updated] = await tx.update(jobOrders).set({ assignedDesignerId: designerId, state: nextState, updatedAt: new Date() }).where(eq(jobOrders.id, orderId))
      .returning({ id: jobOrders.id, assignedDesignerId: jobOrders.assignedDesignerId, state: jobOrders.state });
    await tx.insert(auditEvents).values({ actorAccountId: actor.accountId, action: "order.designer_assigned", entityType: "job_order", entityId: orderId, metadata: { previousDesignerId: order.assignedDesignerId, designerId, previousState: order.state, nextState } });
    return updated;
  });
}

export async function updateProductOffer(actor: Actor, input: unknown) {
  admin(actor);
  const parsed = offerUpdateSchema.parse(input);
  if (parsed.enabled && !commerceReady()) throw new CommerceConflictError("Configure payment credentials, analytics, service terms, cancellation policy, tax notice, and application URL before opening sales");
  const [offer] = await getDb().insert(productOffers).values(parsed).onConflictDoUpdate({
    target: [productOffers.productSlug, productOffers.tier],
    set: { priceMinor: parsed.priceMinor, turnaroundDays: parsed.turnaroundDays, enabled: parsed.enabled, updatedAt: new Date() },
  }).returning();
  return offer;
}
