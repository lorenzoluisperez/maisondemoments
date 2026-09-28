import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { commerceErrorResponse } from "@/lib/commerce/http";
import { createPurchase, listCustomerPurchases } from "@/lib/commerce/purchases";
import { isTrustedMutationRequest, readBoundedJson } from "@/lib/http/request-security";

export async function GET() {
  try { return NextResponse.json({ purchases: await listCustomerPurchases(await requireCurrentActor()) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return commerceErrorResponse(error) ?? NextResponse.json({ error: "Could not load purchases" }, { status: 500 }); }
}
export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try { return NextResponse.json({ purchase: await createPurchase(await requireCurrentActor(), await readBoundedJson(request)) }, { status: 201 }); }
  catch (error) { return commerceErrorResponse(error) ?? NextResponse.json({ error: "Could not start checkout" }, { status: 500 }); }
}
