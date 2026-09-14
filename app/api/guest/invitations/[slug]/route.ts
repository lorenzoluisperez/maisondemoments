import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GUEST_COOKIE } from "@/lib/guests/config";
import { guestErrorResponse } from "@/lib/guests/http-errors";
import { getGuestInvitation } from "@/lib/guests/service";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const token = (await cookies()).get(GUEST_COOKIE)?.value;
    if (!token) return NextResponse.json({ error: "Invitation link required" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json(await getGuestInvitation((await params).slug, token), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return guestErrorResponse(error) ?? Promise.reject(error); }
}
