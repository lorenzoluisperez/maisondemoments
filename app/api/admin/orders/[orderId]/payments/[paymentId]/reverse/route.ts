import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { isTrustedMutationRequest, PayloadTooLargeError, readBoundedJson } from "@/lib/http/request-security";
import { paymentErrorResponse } from "@/lib/payments/http-errors";
import { reversePayment } from "@/lib/payments/service";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string; paymentId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  try {
    const { orderId, paymentId } = await params;
    return NextResponse.json({ ledger: await reversePayment(await requireCurrentActor(), orderId, paymentId, await readBoundedJson(request)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    const response = paymentErrorResponse(error); if (response) return response; throw error;
  }
}
