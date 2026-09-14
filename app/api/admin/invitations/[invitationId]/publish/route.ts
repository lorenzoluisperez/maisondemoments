import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { isTrustedMutationRequest, PayloadTooLargeError, readBoundedJson } from "@/lib/http/request-security";
import { reviewErrorResponse } from "@/lib/reviews/http-errors";
import { publishApprovedVersion } from "@/lib/reviews/service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ invitationId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  try {
    const actor = await requireCurrentActor();
    const { invitationId } = await params;
    return NextResponse.json({ history: await publishApprovedVersion(actor, invitationId, await readBoundedJson(request)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    const response = reviewErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
