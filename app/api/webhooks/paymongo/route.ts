import { NextResponse } from "next/server";
import { applyPaymongoPaidEvent, type CheckoutPaidEvent, verifyPaymongoSignature } from "@/lib/commerce/paymongo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 128 * 1024 || !verifyPaymongoSignature(raw, request.headers.get("paymongo-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  try {
    await applyPaymongoPaidEvent(JSON.parse(raw) as CheckoutPaidEvent);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Payment could not be reconciled" }, { status: 500 });
  }
}
