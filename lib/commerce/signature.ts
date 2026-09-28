import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyPaymongoSignatureBody(body: string, header: string | null, secret: string, live: boolean, now = Date.now()) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((part) => part.trim().split("=", 2)));
  const timestamp = parts.t;
  const actual = parts[live ? "li" : "te"];
  if (!timestamp || !/^\d+$/.test(timestamp) || !actual || !/^[0-9a-f]{64}$/i.test(actual)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}
