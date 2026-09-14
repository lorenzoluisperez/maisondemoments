import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccountSetupRequiredError, AuthenticationRequiredError } from "@/lib/auth/current-actor";
import { StudioAuthorizationError, StudioConflictError, StudioNotFoundError } from "@/lib/studio/service";
import { OrderAuthorizationError, OrderNotFoundError } from "@/lib/orders/service";

export function studioErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof AccountSetupRequiredError || error instanceof StudioAuthorizationError || error instanceof OrderAuthorizationError) return NextResponse.json({ error: "Studio order not found" }, { status: 404 });
  if (error instanceof OrderNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof StudioNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof StudioConflictError) return NextResponse.json({ error: error.message, currentRevision: error.currentRevision }, { status: 409 });
  if (error instanceof ZodError) return NextResponse.json({ error: "Invalid studio update", fields: error.flatten().fieldErrors }, { status: 400 });
  return null;
}
