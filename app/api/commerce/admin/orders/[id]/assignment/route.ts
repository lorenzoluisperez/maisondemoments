import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { commerceErrorResponse } from "@/lib/commerce/http";
import { assignProductionOrder } from "@/lib/commerce/purchases";
import { isTrustedMutationRequest, readBoundedJson } from "@/lib/http/request-security";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try {
    const { id } = await context.params;
    const body = await readBoundedJson(request) as { designerId?: unknown };
    if (body.designerId !== null && typeof body.designerId !== "string") return NextResponse.json({ error: "Choose a designer" }, { status: 400 });
    return NextResponse.json({ order: await assignProductionOrder(await requireCurrentActor(), id, body.designerId) });
  } catch (error) { return commerceErrorResponse(error) ?? NextResponse.json({ error: "Could not assign order" }, { status: 500 }); }
}
