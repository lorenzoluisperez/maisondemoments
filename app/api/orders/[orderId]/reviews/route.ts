import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { reviewErrorResponse } from "@/lib/reviews/http-errors";
import { listReviewHistory } from "@/lib/reviews/service";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const actor = await requireCurrentActor();
    const { orderId } = await params;
    return NextResponse.json({ history: await listReviewHistory(actor, orderId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = reviewErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
