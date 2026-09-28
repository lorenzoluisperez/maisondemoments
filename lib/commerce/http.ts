import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccountSetupRequiredError, AuthenticationRequiredError } from "@/lib/auth/current-actor";
import { CommerceConflictError, CommerceForbiddenError } from "@/lib/commerce/purchases";
import { PayloadTooLargeError } from "@/lib/http/request-security";

export function commerceErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  if (error instanceof AccountSetupRequiredError || error instanceof CommerceForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof CommerceConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Please check your details" }, { status: 400 });
  if (error instanceof PayloadTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
  return null;
}
