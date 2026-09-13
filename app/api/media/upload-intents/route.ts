import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { isTrustedMutationRequest, PayloadTooLargeError, readBoundedJson } from "@/lib/http/request-security";
import { mediaErrorResponse } from "@/lib/media/http-errors";
import { uploadIntentSchema } from "@/lib/media/policy";
import { createMediaUploadIntent } from "@/lib/media/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  }
  try {
    const actor = await requireCurrentActor();
    const intent = await createMediaUploadIntent(actor, uploadIntentSchema.parse(await readBoundedJson(request)));
    return NextResponse.json({ intent }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    const response = mediaErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
