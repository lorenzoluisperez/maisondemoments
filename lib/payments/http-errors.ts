import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccountSetupRequiredError, AuthenticationRequiredError } from "@/lib/auth/current-actor";
import { PaymentAuthorizationError, PaymentConflictError, PaymentNotFoundError } from "@/lib/payments/service";

export function paymentErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof AccountSetupRequiredError || error instanceof PaymentAuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof PaymentNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof PaymentConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof ZodError) return NextResponse.json({ error: "Invalid payment data", fields: error.flatten().fieldErrors }, { status: 400 });
  return null;
}
