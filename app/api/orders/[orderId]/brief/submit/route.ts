import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { contentErrorResponse } from "@/lib/content/http-errors";
import { submitEventBrief } from "@/lib/content/service";
import { isTrustedMutationRequest, PayloadTooLargeError, readBoundedJson } from "@/lib/http/request-security";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  try {
    const actor = await requireCurrentActor();
    const { orderId } = await params;
    const brief = await submitEventBrief(actor, orderId, await readBoundedJson(request));
    return NextResponse.json({ brief }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    const response = contentErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
