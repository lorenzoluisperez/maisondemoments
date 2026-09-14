import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccountSetupRequiredError, AuthenticationRequiredError, requireCurrentActor } from "@/lib/auth/current-actor";
import { isTrustedMutationRequest, PayloadTooLargeError, readBoundedJson } from "@/lib/http/request-security";
import { createJobOrderSchema } from "@/lib/orders/contracts";
import { createJobOrder, OrderAuthorizationError, OrderReferenceError, OrderValidationError } from "@/lib/orders/service";
import { listContentOrders } from "@/lib/content/service";

export async function GET() {
  try {
    const actor = await requireCurrentActor();
    const orders = await listContentOrders(actor);
    return NextResponse.json({ orders }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof AccountSetupRequiredError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  }

  try {
    const actor = await requireCurrentActor();
    const input = createJobOrderSchema.parse(await readBoundedJson(request));
    const order = await createJobOrder(actor, input);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof AccountSetupRequiredError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof OrderAuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof OrderReferenceError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof PayloadTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof OrderValidationError || error instanceof ZodError) return NextResponse.json({ error: "Invalid order data" }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    throw error;
  }
}
