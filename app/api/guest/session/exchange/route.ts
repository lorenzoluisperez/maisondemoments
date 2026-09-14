import { NextResponse } from "next/server";
import { GUEST_COOKIE } from "@/lib/guests/config";
import { guestExchangeSchema } from "@/lib/guests/contracts";
import { guestErrorResponse } from "@/lib/guests/http-errors";
import { exchangeGuestLink } from "@/lib/guests/service";
import { isTrustedMutationRequest, readBoundedJson } from "@/lib/http/request-security";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  try {
    const input = guestExchangeSchema.parse(await readBoundedJson(request));
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
    const session = await exchangeGuestLink(input.slug, input.token, `${forwarded}:${input.slug}`);
    const response = NextResponse.json({ exchanged: true }, { headers: { "Cache-Control": "private, no-store" } });
    response.cookies.set(GUEST_COOKIE, session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: session.expiresAt });
    return response;
  } catch (error) { return guestErrorResponse(error) ?? Promise.reject(error); }
}
