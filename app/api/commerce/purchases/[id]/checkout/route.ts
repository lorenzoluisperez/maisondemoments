import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { commerceErrorResponse } from "@/lib/commerce/http";
import { createOrReuseCheckout } from "@/lib/commerce/paymongo";
import { isTrustedMutationRequest } from "@/lib/http/request-security";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try { const { id } = await params; return NextResponse.json({ url: await createOrReuseCheckout(await requireCurrentActor(), id) }); }
  catch (error) { return commerceErrorResponse(error) ?? NextResponse.json({ error: "Could not prepare payment" }, { status: 500 }); }
}
