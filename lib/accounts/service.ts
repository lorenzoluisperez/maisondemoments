import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { accounts, staffMemberships } from "@/db/schema";
import type { Actor } from "@/lib/auth/permissions";

const customerProfileSchema = z.object({
  authUserId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320),
}).strict();

export class AccountNotFoundError extends Error {}

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
