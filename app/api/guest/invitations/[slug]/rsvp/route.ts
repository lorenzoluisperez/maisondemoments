import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GUEST_COOKIE } from "@/lib/guests/config";
import { guestErrorResponse } from "@/lib/guests/http-errors";
import { submitGuestRsvp } from "@/lib/guests/service";
import { isTrustedMutationRequest, readBoundedJson } from "@/lib/http/request-security";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  try {
    const token = (await cookies()).get(GUEST_COOKIE)?.value;
    if (!token) return NextResponse.json({ error: "Invitation link required" }, { status: 401 });
    return NextResponse.json(await submitGuestRsvp((await params).slug, token, await readBoundedJson(request)), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return guestErrorResponse(error) ?? Promise.reject(error); }
}
