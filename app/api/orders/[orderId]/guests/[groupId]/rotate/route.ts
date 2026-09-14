import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { guestErrorResponse } from "@/lib/guests/http-errors";
import { rotateHouseholdLink } from "@/lib/guests/service";
import { isTrustedMutationRequest, readBoundedJson } from "@/lib/http/request-security";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string; groupId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  try { const actor = await requireCurrentActor(); const values = await params; return NextResponse.json(await rotateHouseholdLink(actor, values.orderId, values.groupId, await readBoundedJson(request)), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return guestErrorResponse(error) ?? Promise.reject(error); }
}
