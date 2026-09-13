import { randomUUID } from "node:crypto";
import { z } from "zod";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 50_000_000;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const uploadIntentSchema = z.object({
  jobOrderId: z.string().uuid(),
  filename: z.string().trim().min(1).max(200),
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
}).strict();

export function quarantineObjectKey(jobOrderId: string, filename: string) {
  const extension = filename.toLowerCase().match(/\.(jpe?g|png|webp)$/)?.[1] ?? "bin";
  return `quarantine/${jobOrderId}/${randomUUID()}.${extension === "jpeg" ? "jpg" : extension}`;
}

export function validateImageDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error("Invalid image dimensions");
  if (width * height > MAX_IMAGE_PIXELS) throw new Error("Image exceeds the 50 megapixel limit");
}
