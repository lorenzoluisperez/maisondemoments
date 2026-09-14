import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccountSetupRequiredError, AuthenticationRequiredError } from "@/lib/auth/current-actor";
import { ContentAuthorizationError, ContentConflictError, ContentNotFoundError, ContentSubmissionError } from "@/lib/content/service";
import { OrderAuthorizationError, OrderNotFoundError } from "@/lib/orders/service";

export function contentErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof AccountSetupRequiredError || error instanceof ContentAuthorizationError || error instanceof OrderAuthorizationError) return NextResponse.json({ error: "Job order not found" }, { status: 404 });
  if (error instanceof OrderNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof ContentNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof ContentConflictError) return NextResponse.json({ error: error.message, currentRevision: error.currentRevision }, { status: 409 });
  if (error instanceof ContentSubmissionError) return NextResponse.json({ error: error.message, issues: error.issues }, { status: 422 });
  if (error instanceof ZodError) return NextResponse.json({ error: "Invalid brief data", fields: error.flatten().fieldErrors }, { status: 400 });
  return null;
}
