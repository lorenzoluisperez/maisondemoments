import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { mediaErrorResponse } from "@/lib/media/http-errors";
import { getMediaStatus } from "@/lib/media/service";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  try {
    const actor = await requireCurrentActor();
    const { mediaId } = await params;
    const media = await getMediaStatus(actor, mediaId);
    return NextResponse.json({ media }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = mediaErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
