import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { addProductionCost } from "@/lib/commerce/costs";
import { commerceErrorResponse } from "@/lib/commerce/http";
import { isTrustedMutationRequest, readBoundedJson } from "@/lib/http/request-security";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try { return NextResponse.json({ entry: await addProductionCost(await requireCurrentActor(), (await params).id, await readBoundedJson(request)) }); }
  catch (error) { return commerceErrorResponse(error) ?? NextResponse.json({ error: "Could not record production cost" }, { status: 500 }); }
}
