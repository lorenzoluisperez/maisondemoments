import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { isTrustedMutationRequest } from "@/lib/http/request-security";
import { reviewErrorResponse } from "@/lib/reviews/http-errors";
import { approveReviewVersion } from "@/lib/reviews/service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  try {
    const actor = await requireCurrentActor();
    const { versionId } = await params;
    return NextResponse.json({ review: await approveReviewVersion(actor, versionId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = reviewErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
