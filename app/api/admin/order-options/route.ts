import { NextResponse } from "next/server";
import { AccountSetupRequiredError, AuthenticationRequiredError, requireCurrentActor } from "@/lib/auth/current-actor";
import { listOrderCreationOptions, OrderAuthorizationError } from "@/lib/orders/service";

export const runtime = "nodejs";
export async function GET() {
  try { return NextResponse.json(await listOrderCreationOptions(await requireCurrentActor()), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof AccountSetupRequiredError || error instanceof OrderAuthorizationError) return NextResponse.json({ error: "Admin permission required" }, { status: 403 });
    throw error;
  }
}
