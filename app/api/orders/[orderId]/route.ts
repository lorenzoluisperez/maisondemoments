import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccountSetupRequiredError, AuthenticationRequiredError, requireCurrentActor } from "@/lib/auth/current-actor";
import { getJobOrder, OrderAuthorizationError, OrderNotFoundError } from "@/lib/orders/service";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const actor = await requireCurrentActor();
    const { orderId } = await params;
    const order = await getJobOrder(actor, orderId);
    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof AccountSetupRequiredError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof OrderAuthorizationError) return NextResponse.json({ error: "Job order not found" }, { status: 404 });
    if (error instanceof OrderNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof ZodError) return NextResponse.json({ error: "Invalid order identifier" }, { status: 400 });
    throw error;
  }
}
