import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db";
import { artworkAssets, artworkCollections, mediaObjects, themeVersions } from "@/db/schema";
import { artworkMetadataSchema } from "@/lib/media/catalog-schema";
import { PRIVATE_MEDIA_BUCKET, QUARANTINE_BUCKET } from "@/lib/media/policy";
import { createAdminClient } from "@/lib/supabase/admin";

try {
  const admin = createAdminClient();
  const buckets = await Promise.all([admin.storage.getBucket(QUARANTINE_BUCKET), admin.storage.getBucket(PRIVATE_MEDIA_BUCKET)]);
  if (buckets.some((bucket) => bucket.error || bucket.data?.public !== false)) throw new Error("Required private media buckets are missing or public");

  const db = getDb();
  const [collections, assets, versions] = await Promise.all([
    db.select().from(artworkCollections),
    db.select().from(artworkAssets),
    db.select().from(themeVersions),
  ]);
  if (collections.length < 2 || assets.length < 2 || versions.length < 2) throw new Error("The released catalog is incomplete");
  assets.forEach((asset) => artworkMetadataSchema.parse(asset.metadata));
  for (const asset of assets) {
    const [media] = await db.select().from(mediaObjects).where(eq(mediaObjects.id, asset.originalMediaId)).limit(1);
    if (!media || media.state !== "READY" || media.usage !== "CATALOG_ARTWORK") throw new Error("Catalog artwork is not backed by ready media");
  }
  console.log(JSON.stringify({ privateBuckets: 2, collections: collections.length, artworkAssets: assets.length, themeVersions: versions.length }));
} finally {
  await closeDb();
}
