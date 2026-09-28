import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { commerceMetricIncrement } from "@/lib/commerce/metrics";
import { isTrustedMutationRequest, readBoundedJson } from "@/lib/http/request-security";
import { weddingProduct } from "@/lib/products/catalog";

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  if (process.env.COMMERCE_ANALYTICS_ENABLED !== "true") return new Response(null, { status: 204 });
  try {
    const body = await readBoundedJson(request) as { slug?: unknown };
    if (typeof body.slug !== "string" || !weddingProduct(body.slug)) return NextResponse.json({ error: "Unknown design" }, { status: 400 });
    await getDb().execute(commerceMetricIncrement(body.slug, "ALL", "PRODUCT_VIEW"));
    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "View could not be recorded" }, { status: 503 });
  }
}
