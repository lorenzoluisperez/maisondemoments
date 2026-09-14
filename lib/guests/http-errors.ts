import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccountSetupRequiredError, AuthenticationRequiredError } from "@/lib/auth/current-actor";
import { GuestAuthorizationError, GuestConflictError, GuestNotFoundError, GuestRateLimitError } from "@/lib/guests/service";
import { PayloadTooLargeError } from "@/lib/http/request-security";

export function guestErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof AccountSetupRequiredError || error instanceof GuestAuthorizationError || error instanceof GuestNotFoundError) return NextResponse.json({ error: "Invitation or household not found" }, { status: 404 });
  if (error instanceof GuestRateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { "Retry-After": "60" } });
  if (error instanceof GuestConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof PayloadTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
  if (error instanceof ZodError) return NextResponse.json({ error: "Invalid guest request", fields: error.flatten().fieldErrors }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  return null;
}
