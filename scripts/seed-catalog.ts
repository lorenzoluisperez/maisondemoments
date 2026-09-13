import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { closeDb, getDb } from "@/db";
import { artworkAssets, artworkCollections, mediaObjects, themes, themeVersions } from "@/db/schema";
import { catalogArtworkAssets } from "@/lib/media/catalog";
import { SITE_CATALOG_BUCKET } from "@/lib/media/policy";

const collectionNames: Record<string, string> = {
  "midnight-garden": "Midnight Garden",
  "luminous-parchment": "Luminous Parchment",
};

try {
  const db = getDb();
  for (const [registryKey, asset] of Object.entries(catalogArtworkAssets)) {
    const path = asset.metadata.delivery.path;
    const input = await readFile(`public${path}`);
    const metadata = await sharp(input).metadata();
    const checksum = createHash("sha256").update(input).digest("hex");
    if (metadata.width !== asset.metadata.width || metadata.height !== asset.metadata.height) {
      throw new Error(`Catalog dimensions do not match metadata for ${registryKey}`);
    }

    await db.transaction(async (transaction) => {
      const [collection] = await transaction.insert(artworkCollections).values({
        key: asset.collectionKey,
        name: collectionNames[asset.collectionKey] ?? asset.collectionKey,
        active: true,
      }).onConflictDoUpdate({
        target: artworkCollections.key,
        set: { name: collectionNames[asset.collectionKey] ?? asset.collectionKey, active: true },
      }).returning();

      const storageKey = path.replace(/^\//, "");
      const [existingMedia] = await transaction.select().from(mediaObjects).where(eq(mediaObjects.storageKey, storageKey)).limit(1);
      if (existingMedia?.checksum && existingMedia.checksum !== checksum) {
        throw new Error(`Catalog path is immutable and its bytes changed: ${path}`);
      }
      const [media] = existingMedia ? [existingMedia] : await transaction.insert(mediaObjects).values({
        usage: "CATALOG_ARTWORK",
        bucket: SITE_CATALOG_BUCKET,
        storageKey,
        originalFilename: storageKey.split("/").at(-1)!,
        detectedContentType: "image/webp",
        bytes: input.length,
        width: metadata.width,
        height: metadata.height,
        checksum,
        state: "READY",
        processingRecipeVersion: 1,
        finalizedAt: new Date(),
      }).returning();

      await transaction.insert(artworkAssets).values({
        collectionId: collection.id,
        key: asset.assetKey,
        originalMediaId: media.id,
        metadata: asset.metadata,
        reuseScope: "REUSABLE",
      }).onConflictDoUpdate({
        target: [artworkAssets.collectionId, artworkAssets.key],
        set: { originalMediaId: media.id, metadata: asset.metadata, reuseScope: "REUSABLE" },
      });

      const [theme] = await transaction.insert(themes).values({
        key: asset.collectionKey,
        name: collectionNames[asset.collectionKey] ?? asset.collectionKey,
      }).onConflictDoUpdate({
        target: themes.key,
        set: { name: collectionNames[asset.collectionKey] ?? asset.collectionKey },
      }).returning();
      await transaction.insert(themeVersions).values({
        themeId: theme.id,
        version: "1.0.0",
        schemaCompatibility: 1,
        definition: {
          schemaVersion: 1,
          collectionKey: asset.collectionKey,
          assetKeys: [registryKey],
          typography: asset.collectionKey === "midnight-garden" ? "romantic-serif" : "editorial-serif",
        },
      }).onConflictDoNothing({ target: [themeVersions.themeId, themeVersions.version] });
    });
  }
  console.log(`Seeded ${Object.keys(catalogArtworkAssets).length} immutable catalog assets`);
} finally {
  await closeDb();
}
