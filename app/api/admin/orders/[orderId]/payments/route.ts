import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { isTrustedMutationRequest, PayloadTooLargeError, readBoundedJson } from "@/lib/http/request-security";
import { paymentErrorResponse } from "@/lib/payments/http-errors";
import { listPayments, recordPayment } from "@/lib/payments/service";

export async function GET(_: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    return NextResponse.json({ ledger: await listPayments(await requireCurrentActor(), orderId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { const response = paymentErrorResponse(error); if (response) return response; throw error; }
}

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  try {
    const { orderId } = await params;
    return NextResponse.json({ ledger: await recordPayment(await requireCurrentActor(), orderId, await readBoundedJson(request)) }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    const response = paymentErrorResponse(error); if (response) return response; throw error;
  }
}
