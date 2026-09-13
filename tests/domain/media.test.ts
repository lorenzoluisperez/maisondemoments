import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { catalogArtworkAssets, getCatalogArtwork } from "@/lib/media/catalog";
import { ImageValidationError, inspectAndProcessImage } from "@/lib/media/image-processor";
import {
  MAX_IMAGE_PIXELS,
  processedObjectKey,
  quarantineObjectKey,
  uploadIntentSchema,
  validateImageDimensions,
} from "@/lib/media/policy";

describe("media policy and processing", () => {
  it("accepts a bounded upload intent and creates deterministic isolated paths", () => {
    const input = uploadIntentSchema.parse({
      jobOrderId: "00000000-0000-4000-8000-000000000001",
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
      filename: "portrait.JPEG",
      contentType: "image/jpeg",
      bytes: 1024,
    });
    expect(quarantineObjectKey(input.jobOrderId, "00000000-0000-4000-8000-000000000003", input.filename))
      .toBe("orders/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000003/original.jpg");
    expect(processedObjectKey(input.jobOrderId, "00000000-0000-4000-8000-000000000003", 960)).toContain("recipe-1/960.webp");
    expect(uploadIntentSchema.safeParse({ ...input, filename: "../portrait.jpg" }).success).toBe(false);
  });

  it("normalizes an image into responsive immutable WebP derivatives", async () => {
    const input = await sharp({ create: { width: 1200, height: 800, channels: 4, background: "#7c3650" } })
      .png()
      .withMetadata({ orientation: 1 })
      .toBuffer();
    const result = await inspectAndProcessImage(input);

    expect(result.detectedContentType).toBe("image/png");
    expect(result).toMatchObject({ width: 1200, height: 800, recipeVersion: 1 });
    expect(result.variants.map((variant) => variant.width)).toEqual([480, 960, 1200]);
    expect(result.variants.every((variant) => variant.contentType === "image/webp" && variant.bytes > 0)).toBe(true);
    const deliveredMetadata = await sharp(result.variants[0].buffer).metadata();
    expect(deliveredMetadata.exif).toBeUndefined();
    expect(deliveredMetadata.icc).toBeUndefined();
  });

  it("rejects malformed input and excessive pixel dimensions", async () => {
    await expect(inspectAndProcessImage(Buffer.from("not-an-image"))).rejects.toBeInstanceOf(ImageValidationError);
    expect(() => validateImageDimensions(MAX_IMAGE_PIXELS + 1, 1)).toThrow("50 megapixel");
  });

  it("keeps every released catalog asset within typed metadata", () => {
    expect(Object.keys(catalogArtworkAssets)).toHaveLength(2);
    expect(getCatalogArtwork("midnight-garden.botanical-frame")?.metadata.delivery.path).toBe("/maison-botanical.webp");
    expect(getCatalogArtwork("unknown")).toBeNull();
  });
});
