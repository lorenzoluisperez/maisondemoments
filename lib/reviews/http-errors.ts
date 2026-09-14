import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccountSetupRequiredError, AuthenticationRequiredError } from "@/lib/auth/current-actor";
import { PublicationBlockedError, ReviewAuthorizationError, ReviewConflictError, ReviewNotFoundError } from "@/lib/reviews/service";

export function reviewErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof AccountSetupRequiredError || error instanceof ReviewAuthorizationError) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  if (error instanceof ReviewNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof ReviewConflictError || error instanceof PublicationBlockedError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof ZodError) return NextResponse.json({ error: "Invalid review request", fields: error.flatten().fieldErrors }, { status: 400 });
  return null;
}
