import "server-only";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { accounts, auditEvents, staffMemberships } from "@/db/schema";
import { canCreateOrder, type Actor } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

const customerProfileSchema = z.object({
  authUserId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320),
}).strict();

export class AccountNotFoundError extends Error {}
export class AccountAuthorizationError extends Error {}
export class AccountConflictError extends Error {}

export async function syncCustomerAccount(input: z.input<typeof customerProfileSchema>) {
  const profile = customerProfileSchema.parse(input);
  const [account] = await getDb()
    .insert(accounts)
    .values({
      authUserId: profile.authUserId,
      displayName: profile.displayName,
      email: profile.email,
      type: "CUSTOMER",
    })
    .onConflictDoUpdate({
      target: accounts.authUserId,
      set: { displayName: profile.displayName, email: profile.email },
    })
    .returning();

  return account;
}

export async function createCustomerAccount(actor: Actor, input: { displayName: string; email: string }) {
  if (!canCreateOrder(actor)) throw new AccountAuthorizationError("Admin permission required");
  const profile = z.object({ displayName: z.string().trim().min(1).max(160), email: z.string().trim().email().max(320) }).strict().parse(input);
  const normalizedEmail = profile.email.toLowerCase();
  const [existing] = await getDb().select({ id: accounts.id }).from(accounts).where(sql`lower(${accounts.email}) = ${normalizedEmail}`).limit(1);
  if (existing) throw new AccountConflictError("A customer account already uses this email address");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: false,
    user_metadata: { display_name: profile.displayName },
  });
  if (error || !data.user) throw new AccountConflictError(error?.message ?? "Customer sign-in record could not be created");

  try {
    return await getDb().transaction(async (transaction) => {
      const [account] = await transaction.insert(accounts).values({ authUserId: data.user.id, displayName: profile.displayName, email: normalizedEmail, type: "CUSTOMER" }).returning();
      await transaction.insert(auditEvents).values({ actorAccountId: actor.accountId, action: "customer.created", entityType: "account", entityId: account.id, metadata: { source: "admin_intake" } });
      return account;
    });
  } catch (databaseError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw databaseError;
  }
}

export async function loadActorForAuthUser(authUserId: string): Promise<Actor> {
  const parsedAuthUserId = z.string().uuid().parse(authUserId);
  const rows = await getDb()
    .select({
      accountId: accounts.id,
      accountType: accounts.type,
      active: accounts.active,
      role: staffMemberships.role,
    })
    .from(accounts)
    .leftJoin(staffMemberships, eq(staffMemberships.accountId, accounts.id))
    .where(eq(accounts.authUserId, parsedAuthUserId));

  const account = rows[0];
  if (!account?.active) throw new AccountNotFoundError("Active account not found");

  return {
    accountId: account.accountId,
    accountType: account.accountType,
    roles: rows.flatMap((row) => row.role ? [row.role] : []),
  };
}
