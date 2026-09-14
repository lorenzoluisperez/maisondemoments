import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { isTrustedMutationRequest, PayloadTooLargeError, readBoundedJson } from "@/lib/http/request-security";
import { reviewErrorResponse } from "@/lib/reviews/http-errors";
import { createReviewVersion } from "@/lib/reviews/service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  try {
    const actor = await requireCurrentActor();
    const { orderId } = await params;
    return NextResponse.json({ review: await createReviewVersion(actor, orderId, await readBoundedJson(request)) }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    const response = reviewErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
