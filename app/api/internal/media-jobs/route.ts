import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cleanupMediaStorage, runMediaWorker } from "@/lib/media/worker";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const configuredSecret = process.env.BACKGROUND_JOB_SECRET;
  const suppliedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!configuredSecret || !safeEqual(configuredSecret, suppliedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const worker = await runMediaWorker("scheduled-media-worker", 2);
  const cleanup = await cleanupMediaStorage(new Date(), 20);
  return NextResponse.json({ worker, cleanup }, { headers: { "Cache-Control": "private, no-store" } });
}

function safeEqual(expected: string, supplied: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && left.length >= 32 && timingSafeEqual(left, right);
}
