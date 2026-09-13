"use client";

import { createClient } from "@/lib/supabase/client";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/media/policy";

export async function uploadCustomerImage(jobOrderId: string, file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new Error("Choose a JPEG, PNG, or WebP image");
  }
  if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) throw new Error("Image must be no larger than 25 MB");

  const intentResponse = await fetch("/api/media/upload-intents", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobOrderId,
      idempotencyKey: crypto.randomUUID(),
      filename: file.name,
      contentType: file.type,
      bytes: file.size,
    }),
  });
  const intentBody = await intentResponse.json() as { intent?: { mediaId: string; bucket: string; path: string; token: string }; error?: string };
  if (!intentResponse.ok || !intentBody.intent) throw new Error(intentBody.error ?? "Could not start the upload");

  const intent = intentBody.intent;
  const uploaded = await createClient().storage.from(intent.bucket).uploadToSignedUrl(intent.path, intent.token, file, {
    contentType: file.type,
    cacheControl: "0",
  });
  if (uploaded.error) throw new Error("The image could not be uploaded");

  const finalized = await fetch(`/api/media/${intent.mediaId}/finalize`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const finalizedBody = await finalized.json() as { media?: { mediaId: string; state: string }; error?: string };
  if (!finalized.ok || !finalizedBody.media) throw new Error(finalizedBody.error ?? "The image could not be finalized");
  return finalizedBody.media;
}
