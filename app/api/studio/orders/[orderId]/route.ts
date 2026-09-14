import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { isTrustedMutationRequest, PayloadTooLargeError, readBoundedJson } from "@/lib/http/request-security";
import { studioErrorResponse } from "@/lib/studio/http-errors";
import { getStudioOrder, saveDraftOverrides } from "@/lib/studio/service";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const actor = await requireCurrentActor();
    const { orderId } = await params;
    return NextResponse.json({ workspace: await getStudioOrder(actor, orderId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = studioErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  try {
    const actor = await requireCurrentActor();
    const { orderId } = await params;
    return NextResponse.json({ workspace: await saveDraftOverrides(actor, orderId, await readBoundedJson(request)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    const response = studioErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
