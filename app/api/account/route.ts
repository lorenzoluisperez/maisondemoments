import { NextResponse } from "next/server";
import { z } from "zod";
import { syncCustomerAccount } from "@/lib/accounts/service";
import { AccountSetupRequiredError, AuthenticationRequiredError, requireCurrentActor } from "@/lib/auth/current-actor";
import { isTrustedMutationRequest, PayloadTooLargeError, readBoundedJson } from "@/lib/http/request-security";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
}).strict();

export async function GET() {
  try {
    const actor = await requireCurrentActor();
    return NextResponse.json({ actor }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof AccountSetupRequiredError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof PayloadTooLargeError ? error.message : "Invalid JSON body" },
      { status: error instanceof PayloadTooLargeError ? 413 : 400 },
    );
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const account = await syncCustomerAccount({
    authUserId: user.id,
    displayName: parsed.data.displayName,
    email: user.email,
  });

  return NextResponse.json({ account: { id: account.id, displayName: account.displayName, type: account.type } });
}
