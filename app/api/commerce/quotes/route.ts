import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { commerceErrorResponse } from "@/lib/commerce/http";
import { listCustomerQuotes, requestCoutureQuote } from "@/lib/commerce/purchases";
import { isTrustedMutationRequest, readBoundedJson } from "@/lib/http/request-security";

export async function GET() {
  try { return NextResponse.json({ quotes: await listCustomerQuotes(await requireCurrentActor()) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return commerceErrorResponse(error) ?? NextResponse.json({ error: "Could not load quotes" }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try { return NextResponse.json({ quote: await requestCoutureQuote(await requireCurrentActor(), await readBoundedJson(request)) }, { status: 201 }); }
  catch (error) { return commerceErrorResponse(error) ?? NextResponse.json({ error: "Could not send request" }, { status: 500 }); }
}
