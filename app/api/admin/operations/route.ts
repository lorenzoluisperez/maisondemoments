import { NextResponse } from "next/server";
import { AccountSetupRequiredError, AuthenticationRequiredError, requireCurrentActor } from "@/lib/auth/current-actor";
import { getOperationsDashboard, OperationsAuthorizationError } from "@/lib/operations/service";

export async function GET() {
  try {
    return NextResponse.json({ dashboard: await getOperationsDashboard(await requireCurrentActor()) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof AccountSetupRequiredError || error instanceof OperationsAuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
}
