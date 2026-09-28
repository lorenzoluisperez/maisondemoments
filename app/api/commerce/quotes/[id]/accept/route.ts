import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { commerceErrorResponse } from "@/lib/commerce/http";
import { acceptCoutureQuote } from "@/lib/commerce/purchases";
import { isTrustedMutationRequest, readBoundedJson } from "@/lib/http/request-security";

const inputSchema = z.object({ eventDate: z.string().date(), timezone: z.string(), contactName: z.string(), acceptedTerms: z.literal(true) }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try { const { id } = await params; const input = inputSchema.parse(await readBoundedJson(request)); return NextResponse.json({ purchase: await acceptCoutureQuote(await requireCurrentActor(), id, input.eventDate, input.timezone, input.contactName, input.acceptedTerms) }); }
  catch (error) { return commerceErrorResponse(error) ?? NextResponse.json({ error: "Could not accept quote" }, { status: 500 }); }
}
