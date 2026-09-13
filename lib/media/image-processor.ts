import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  contentTypeForSharpFormat,
  MAX_IMAGE_PIXELS,
  MAX_MEDIA_VARIANT_HEIGHT,
  MAX_UPLOAD_BYTES,
  MEDIA_RECIPE_VERSION,
  MEDIA_VARIANT_WIDTHS,
  validateImageDimensions,
} from "@/lib/media/policy";

export class ImageValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export type ProcessedImage = {
  detectedContentType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  checksum: string;
  recipeVersion: number;
  variants: Array<{
    width: number;
    height: number;
    bytes: number;
    checksum: string;
    contentType: "image/webp";
    format: "webp";
    buffer: Buffer;
  }>;
};

export async function inspectAndProcessImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length < 1 || input.length > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError("IMAGE_SIZE_INVALID", "Image size is outside the allowed range");
  }

  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(input, { failOn: "warning", limitInputPixels: MAX_IMAGE_PIXELS, sequentialRead: true }).metadata();
  } catch {
    throw new ImageValidationError("MALFORMED_IMAGE", "The image could not be decoded");
  }

  const detectedContentType = contentTypeForSharpFormat(metadata.format);
  if (!detectedContentType) throw new ImageValidationError("UNSUPPORTED_IMAGE_TYPE", "Only JPEG, PNG, and WebP images are supported");
  if ((metadata.pages ?? 1) > 1) throw new ImageValidationError("ANIMATED_IMAGE", "Animated images are not supported");
  if (!metadata.width || !metadata.height) throw new ImageValidationError("MISSING_DIMENSIONS", "Image dimensions could not be detected");

  const rotatesDimensions = metadata.orientation !== undefined && metadata.orientation >= 5 && metadata.orientation <= 8;
  const width = rotatesDimensions ? metadata.height : metadata.width;
  const height = rotatesDimensions ? metadata.width : metadata.height;
  try {
    validateImageDimensions(width, height);
  } catch (error) {
    throw new ImageValidationError("IMAGE_DIMENSIONS_INVALID", error instanceof Error ? error.message : "Invalid image dimensions");
  }

  const targetWidths = [...new Set(MEDIA_VARIANT_WIDTHS.map((candidateWidth) => Math.min(width, candidateWidth)))]
    .sort((left, right) => left - right);
  const source = sharp(input, { failOn: "warning", limitInputPixels: MAX_IMAGE_PIXELS, sequentialRead: true })
    .rotate()
    .toColorspace("srgb");

  const generatedVariants = await Promise.all(targetWidths.map(async (targetWidth) => {
    try {
      const result = await source.clone()
        .resize({ width: targetWidth, height: MAX_MEDIA_VARIANT_HEIGHT, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      return {
        width: result.info.width,
        height: result.info.height,
        bytes: result.data.length,
        checksum: createHash("sha256").update(result.data).digest("hex"),
        contentType: "image/webp" as const,
        format: "webp" as const,
        buffer: result.data,
      };
    } catch {
      throw new ImageValidationError("IMAGE_PROCESSING_FAILED", "The image could not be normalized");
    }
  }));

  const variants = [...new Map(generatedVariants.map((variant) => [
    `${variant.width}x${variant.height}`,
    variant,
  ])).values()];

  return {
    detectedContentType,
    width,
    height,
    checksum: createHash("sha256").update(input).digest("hex"),
    recipeVersion: MEDIA_RECIPE_VERSION,
    variants,
  };
}
