import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { commerceErrorResponse } from "@/lib/commerce/http";
import { listAdminCommerce, updateProductOffer } from "@/lib/commerce/purchases";
import { isTrustedMutationRequest, readBoundedJson } from "@/lib/http/request-security";

export async function GET() {
  try { return NextResponse.json(await listAdminCommerce(await requireCurrentActor()), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return commerceErrorResponse(error) ?? NextResponse.json({ error: "Could not load commerce operations" }, { status: 500 }); }
}
export async function PATCH(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try { return NextResponse.json({ offer: await updateProductOffer(await requireCurrentActor(), await readBoundedJson(request)) }); }
  catch (error) { return commerceErrorResponse(error) ?? NextResponse.json({ error: "Could not update pricing" }, { status: 500 }); }
}
