import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { mediaErrorResponse } from "@/lib/media/http-errors";
import { getMediaDelivery } from "@/lib/media/service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  try {
    const actor = await requireCurrentActor();
    const { mediaId } = await params;
    const width = Number(new URL(request.url).searchParams.get("width") ?? 960);
    const asset = await getMediaDelivery(actor, mediaId, width);
    return NextResponse.json({ asset }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = mediaErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
