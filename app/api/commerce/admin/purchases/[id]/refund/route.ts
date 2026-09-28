import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { commerceErrorResponse } from "@/lib/commerce/http";
import { confirmPaymongoFullRefund } from "@/lib/commerce/paymongo";
import { isTrustedMutationRequest, readBoundedJson } from "@/lib/http/request-security";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try {
    const { id } = await params;
    const input = await readBoundedJson(request) as { refundId?: unknown };
    if (typeof input.refundId !== "string") return NextResponse.json({ error: "PayMongo refund reference required" }, { status: 400 });
    return NextResponse.json(await confirmPaymongoFullRefund(await requireCurrentActor(), id, input.refundId));
  } catch (error) {
    return commerceErrorResponse(error) ?? NextResponse.json({ error: "Could not confirm refund" }, { status: 500 });
  }
}
