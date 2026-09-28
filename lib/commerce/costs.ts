import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, productionCostEntries, purchases } from "@/db/schema";
import type { Actor } from "@/lib/auth/permissions";
import { CommerceConflictError, CommerceForbiddenError } from "@/lib/commerce/purchases";
import { productionCostSchema, productionCostVoidSchema } from "@/lib/commerce/cost-contracts";

function admin(actor: Actor) {
  if (actor.accountType !== "STAFF" || !actor.roles.includes("ADMIN")) throw new CommerceForbiddenError("Admin access required");
}

export async function addProductionCost(actor: Actor, purchaseId: string, input: unknown) {
  admin(actor);
  const id = z.string().uuid().parse(purchaseId);
  const parsed = productionCostSchema.parse(input);
  return getDb().transaction(async (tx) => {
    const [purchase] = await tx.select({ id: purchases.id, status: purchases.status }).from(purchases).where(eq(purchases.id, id)).limit(1);
    if (!purchase || !["PAID", "ORDER_CREATED", "REFUNDED"].includes(purchase.status)) throw new CommerceConflictError("A paid purchase is required for production costs");
    const [entry] = await tx.insert(productionCostEntries).values({ purchaseId: id, ...parsed, recordedBy: actor.accountId }).returning();
    await tx.insert(auditEvents).values({ actorAccountId: actor.accountId, action: "production.cost_recorded", entityType: "purchase", entityId: id, metadata: { costEntryId: entry.id, category: entry.category, minutes: entry.minutes, amountMinor: entry.amountMinor } });
    return entry;
  });
}

export async function voidProductionCost(actor: Actor, purchaseId: string, costId: string, input: unknown) {
  admin(actor);
  const id = z.string().uuid().parse(purchaseId);
  const entryId = z.string().uuid().parse(costId);
  const { reason } = productionCostVoidSchema.parse(input);
  return getDb().transaction(async (tx) => {
    const [entry] = await tx.update(productionCostEntries).set({ voidedAt: new Date(), voidedBy: actor.accountId })
      .where(and(eq(productionCostEntries.id, entryId), eq(productionCostEntries.purchaseId, id), isNull(productionCostEntries.voidedAt))).returning();
    if (!entry) throw new CommerceConflictError("Cost entry was already corrected or does not belong to this purchase");
    await tx.insert(auditEvents).values({ actorAccountId: actor.accountId, action: "production.cost_voided", entityType: "purchase", entityId: id, metadata: { costEntryId: entry.id, reason } });
    return entry;
  });
}
