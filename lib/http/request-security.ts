const MAX_JSON_BYTES = 128 * 1024;

export class PayloadTooLargeError extends Error {}

export function isTrustedMutationRequest(request: Request) {
  const origin = request.headers.get("origin");
  const contentType = request.headers.get("content-type");
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (!origin || origin !== new URL(request.url).origin) return false;
  if (!contentType?.toLowerCase().startsWith("application/json")) return false;
  return Number.isSafeInteger(contentLength) && contentLength >= 0 && contentLength <= MAX_JSON_BYTES;
}

export async function readBoundedJson(request: Request) {
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_JSON_BYTES) {
    throw new PayloadTooLargeError("JSON request exceeds 128 KiB");
  }
  return JSON.parse(body) as unknown;
}
