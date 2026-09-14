import { NextResponse } from "next/server";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { guestErrorResponse } from "@/lib/guests/http-errors";
import { exportHouseholdCsv } from "@/lib/guests/service";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const actor = await requireCurrentActor();
    const csv = await exportHouseholdCsv(actor, (await params).orderId);
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=guest-responses.csv", "Cache-Control": "private, no-store" } });
  } catch (error) { return guestErrorResponse(error) ?? Promise.reject(error); }
}
