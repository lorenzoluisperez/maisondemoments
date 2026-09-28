import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { commerceErrorResponse } from "@/lib/commerce/http";
import { getCustomerPurchase } from "@/lib/commerce/purchases";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; return NextResponse.json({ purchase: await getCustomerPurchase(await requireCurrentActor(), id) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return commerceErrorResponse(error) ?? NextResponse.json({ error: "Could not load purchase" }, { status: 500 }); }
}
