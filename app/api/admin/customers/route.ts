import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccountAuthorizationError, AccountConflictError, createCustomerAccount } from "@/lib/accounts/service";
import { AccountSetupRequiredError, AuthenticationRequiredError, requireCurrentActor } from "@/lib/auth/current-actor";
import { isTrustedMutationRequest, PayloadTooLargeError, readBoundedJson } from "@/lib/http/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  try {
    const account = await createCustomerAccount(await requireCurrentActor(), await readBoundedJson(request) as { displayName: string; email: string });
    return NextResponse.json({ customer: { id: account.id, name: account.displayName, email: account.email } }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof AccountSetupRequiredError || error instanceof AccountAuthorizationError) return NextResponse.json({ error: "Admin permission required" }, { status: 403 });
    if (error instanceof AccountConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof PayloadTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid customer details" }, { status: 400 });
    throw error;
  }
}
