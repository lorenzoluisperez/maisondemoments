import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { commerceErrorResponse } from "@/lib/commerce/http";
import { offerCoutureQuote } from "@/lib/commerce/purchases";
import { isTrustedMutationRequest, readBoundedJson } from "@/lib/http/request-security";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try { const { id } = await params; return NextResponse.json({ quote: await offerCoutureQuote(await requireCurrentActor(), id, await readBoundedJson(request)) }); }
  catch (error) { return commerceErrorResponse(error) ?? NextResponse.json({ error: "Could not offer quote" }, { status: 500 }); }
}
