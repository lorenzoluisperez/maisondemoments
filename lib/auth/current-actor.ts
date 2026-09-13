import "server-only";

import { AccountNotFoundError, loadActorForAuthUser } from "@/lib/accounts/service";
import { createClient } from "@/lib/supabase/server";

export class AuthenticationRequiredError extends Error {}
export class AccountSetupRequiredError extends Error {}

export async function requireCurrentActor() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;

  if (error || typeof subject !== "string") {
    throw new AuthenticationRequiredError("Authentication required");
  }

  try {
    return await loadActorForAuthUser(subject);
  } catch (accountError) {
    if (accountError instanceof AccountNotFoundError) {
      throw new AccountSetupRequiredError("Account setup required");
    }
    throw accountError;
  }
}
