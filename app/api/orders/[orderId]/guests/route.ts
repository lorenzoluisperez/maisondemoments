import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { guestErrorResponse } from "@/lib/guests/http-errors";
import { createHousehold, listHouseholds } from "@/lib/guests/service";
import { isTrustedMutationRequest, PayloadTooLargeError, readBoundedJson } from "@/lib/http/request-security";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try { const actor = await requireCurrentActor(); return NextResponse.json(await listHouseholds(actor, (await params).orderId), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return guestErrorResponse(error) ?? Promise.reject(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  try { const actor = await requireCurrentActor(); return NextResponse.json(await createHousehold(actor, (await params).orderId, await readBoundedJson(request)), { status: 201, headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { if (error instanceof PayloadTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 }); return guestErrorResponse(error) ?? Promise.reject(error); }
}
