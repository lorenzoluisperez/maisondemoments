import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { commerceErrorResponse } from "@/lib/commerce/http";
import { getPurchaseBrief, savePurchaseBrief } from "@/lib/commerce/purchases";
import { isTrustedMutationRequest, readBoundedJson } from "@/lib/http/request-security";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; return NextResponse.json({ brief: await getPurchaseBrief(await requireCurrentActor(), id) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return commerceErrorResponse(error) ?? NextResponse.json({ error: "Could not load brief" }, { status: 500 }); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try { const { id } = await params; return NextResponse.json({ brief: await savePurchaseBrief(await requireCurrentActor(), id, await readBoundedJson(request)) }); }
  catch (error) { return commerceErrorResponse(error) ?? NextResponse.json({ error: "Could not save brief" }, { status: 500 }); }
}
