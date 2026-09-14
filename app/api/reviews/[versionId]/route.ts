import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { reviewErrorResponse } from "@/lib/reviews/http-errors";
import { getReviewVersion } from "@/lib/reviews/service";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const actor = await requireCurrentActor();
    const { versionId } = await params;
    return NextResponse.json({ review: await getReviewVersion(actor, versionId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = reviewErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
