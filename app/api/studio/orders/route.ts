import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { studioErrorResponse } from "@/lib/studio/http-errors";
import { listStudioOrders } from "@/lib/studio/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireCurrentActor();
    return NextResponse.json({ orders: await listStudioOrders(actor) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = studioErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
