import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { isTrustedMutationRequest } from "@/lib/http/request-security";
import { mediaErrorResponse } from "@/lib/media/http-errors";
import { finalizeMediaUpload } from "@/lib/media/service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin or content type" }, { status: 403 });
  }
  try {
    const actor = await requireCurrentActor();
    const { mediaId } = await params;
    const media = await finalizeMediaUpload(actor, mediaId);
    return NextResponse.json({ media }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = mediaErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
