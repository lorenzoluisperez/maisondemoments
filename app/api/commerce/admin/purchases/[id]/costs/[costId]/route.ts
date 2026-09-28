import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { voidProductionCost } from "@/lib/commerce/costs";
import { commerceErrorResponse } from "@/lib/commerce/http";
import { isTrustedMutationRequest, readBoundedJson } from "@/lib/http/request-security";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; costId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try {
    const { id, costId } = await params;
    return NextResponse.json({ entry: await voidProductionCost(await requireCurrentActor(), id, costId, await readBoundedJson(request)) });
  } catch (error) { return commerceErrorResponse(error) ?? NextResponse.json({ error: "Could not correct production cost" }, { status: 500 }); }
}
