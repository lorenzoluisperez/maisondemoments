import "server-only";

import { AccountNotFoundError, loadActorForAuthUser } from "@/lib/accounts/service";
import { createClient } from "@/lib/supabase/server";

export class AuthenticationRequiredError extends Error {}
export class AccountSetupRequiredError extends Error {}
export class MfaRequiredError extends AuthenticationRequiredError {}

export async function requireCurrentActor() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;

  if (error || typeof subject !== "string") {
    throw new AuthenticationRequiredError("Authentication required");
  }

  try {
    const actor = await loadActorForAuthUser(subject);
    if (actor.accountType === "STAFF" && data?.claims?.aal !== "aal2") {
      throw new MfaRequiredError("Staff verification required");
    }
    return actor;
  } catch (accountError) {
    if (accountError instanceof AccountNotFoundError) {
      throw new AccountSetupRequiredError("Account setup required");
    }
    throw accountError;
  }
}
