import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccountSetupRequiredError, AuthenticationRequiredError } from "@/lib/auth/current-actor";
import {
  MediaAuthorizationError,
  MediaConflictError,
  MediaNotFoundError,
  MediaQuotaError,
} from "@/lib/media/service";
import { MediaStorageError } from "@/lib/media/storage";

export function mediaErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof AccountSetupRequiredError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof MediaAuthorizationError || error instanceof MediaNotFoundError) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
  if (error instanceof MediaQuotaError) return NextResponse.json({ error: error.message }, { status: 422 });
  if (error instanceof MediaConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof MediaStorageError) return NextResponse.json({ error: "Media storage is temporarily unavailable" }, { status: 503 });
  if (error instanceof ZodError) return NextResponse.json({ error: "Invalid media request", fields: error.flatten().fieldErrors }, { status: 400 });
  return null;
}
