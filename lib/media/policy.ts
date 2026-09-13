import { z } from "zod";

export const QUARANTINE_BUCKET = "maison-quarantine";
export const PRIVATE_MEDIA_BUCKET = "maison-private-media";
export const SITE_CATALOG_BUCKET = "site-public";
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 50_000_000;
export const MAX_MEDIA_PER_ORDER = 12;
export const MAX_MEDIA_BYTES_PER_ORDER = MAX_MEDIA_PER_ORDER * MAX_UPLOAD_BYTES;
export const MEDIA_RECIPE_VERSION = 1;
export const MEDIA_SIGNED_URL_SECONDS = 300;
export const MEDIA_VARIANT_WIDTHS = [480, 960, 1600] as const;
export const MAX_MEDIA_VARIANT_HEIGHT = 2400;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const uploadIntentSchema = z.object({
  jobOrderId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  filename: z.string().trim().min(1).max(200)
    .refine((value) => !/[\\/\u0000-\u001f\u007f]/.test(value), "Filename contains unsupported characters"),
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
}).strict();

export type UploadIntentInput = z.input<typeof uploadIntentSchema>;

export function quarantineObjectKey(jobOrderId: string, mediaId: string, filename: string) {
  const extension = filename.toLowerCase().match(/\.(jpe?g|png|webp)$/)?.[1] ?? "bin";
  return `orders/${jobOrderId}/${mediaId}/original.${extension === "jpeg" ? "jpg" : extension}`;
}

export function processedObjectKey(jobOrderId: string, mediaId: string, width: number) {
  return `orders/${jobOrderId}/${mediaId}/recipe-${MEDIA_RECIPE_VERSION}/${width}.webp`;
}

export function validatedOriginalObjectKey(jobOrderId: string, mediaId: string, contentType: string) {
  const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
  return `orders/${jobOrderId}/${mediaId}/recipe-${MEDIA_RECIPE_VERSION}/original.${extension}`;
}

export function validateImageDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error("Invalid image dimensions");
  if (width * height > MAX_IMAGE_PIXELS) throw new Error("Image exceeds the 50 megapixel limit");
}

export function contentTypeForSharpFormat(format: string | undefined) {
  if (format === "jpeg") return "image/jpeg" as const;
  if (format === "png") return "image/png" as const;
  if (format === "webp") return "image/webp" as const;
  return null;
}
