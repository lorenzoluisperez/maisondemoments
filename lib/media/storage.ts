import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  MEDIA_SIGNED_URL_SECONDS,
  PRIVATE_MEDIA_BUCKET,
  QUARANTINE_BUCKET,
} from "@/lib/media/policy";

export class MediaStorageError extends Error {}

export async function ensureMediaBuckets() {
  const storage = createAdminClient().storage;
  await ensureBucket(storage, QUARANTINE_BUCKET, MAX_UPLOAD_BYTES, [...ALLOWED_IMAGE_TYPES]);
  await ensureBucket(storage, PRIVATE_MEDIA_BUCKET, MAX_UPLOAD_BYTES, [...ALLOWED_IMAGE_TYPES]);
}

async function ensureBucket(
  storage: ReturnType<typeof createAdminClient>["storage"],
  bucket: string,
  fileSizeLimit: number,
  allowedMimeTypes: string[],
) {
  const existing = await storage.getBucket(bucket);
  if (existing.error && existing.error.statusCode !== "404") throw new MediaStorageError(`Could not inspect ${bucket}: ${existing.error.message}`);
  if (!existing.data) {
    const created = await storage.createBucket(bucket, { public: false, fileSizeLimit, allowedMimeTypes });
    if (created.error) throw new MediaStorageError(`Could not create ${bucket}: ${created.error.message}`);
    return;
  }
  const updated = await storage.updateBucket(bucket, { public: false, fileSizeLimit, allowedMimeTypes });
  if (updated.error) throw new MediaStorageError(`Could not configure ${bucket}: ${updated.error.message}`);
}

export async function createQuarantineUploadToken(path: string) {
  const result = await createAdminClient().storage.from(QUARANTINE_BUCKET).createSignedUploadUrl(path, { upsert: false });
  if (result.error) throw new MediaStorageError(`Could not create upload token: ${result.error.message}`);
  return { path: result.data.path, token: result.data.token };
}

export async function getPrivateObjectInfo(bucket: string, path: string) {
  const result = await createAdminClient().storage.from(bucket).info(path);
  if (result.error) throw new MediaStorageError(`Could not inspect uploaded object: ${result.error.message}`);
  return {
    size: result.data.size,
    contentType: result.data.contentType,
    etag: result.data.etag,
    lastModified: result.data.lastModified,
  };
}

export async function downloadPrivateObject(bucket: string, path: string) {
  const result = await createAdminClient().storage.from(bucket).download(path);
  if (result.error) throw new MediaStorageError(`Could not download uploaded object: ${result.error.message}`);
  return Buffer.from(await result.data.arrayBuffer());
}

export async function putImmutablePrivateObject(path: string, body: Buffer, contentType: string) {
  const bucket = createAdminClient().storage.from(PRIVATE_MEDIA_BUCKET);
  const existing = await bucket.info(path);
  if (existing.data) {
    if (existing.data.size !== undefined && existing.data.size !== body.length) {
      throw new MediaStorageError("Immutable media path already contains different content");
    }
    return { size: existing.data.size ?? body.length, contentType: existing.data.contentType ?? contentType };
  }

  const uploaded = await bucket.upload(path, body, { contentType, cacheControl: String(MEDIA_SIGNED_URL_SECONDS), upsert: false });
  if (!uploaded.error) return { size: body.length, contentType };

  const raced = await bucket.info(path);
  if (raced.data) {
    if (raced.data.size !== undefined && raced.data.size !== body.length) {
      throw new MediaStorageError("Immutable media path already contains different content");
    }
    return { size: raced.data.size ?? body.length, contentType: raced.data.contentType ?? contentType };
  }
  throw new MediaStorageError(`Could not write processed image: ${uploaded.error.message}`);
}

export async function createPrivateSignedUrls(paths: string[]) {
  if (!paths.length) return new Map<string, string>();
  const result = await createAdminClient().storage.from(PRIVATE_MEDIA_BUCKET).createSignedUrls(paths, MEDIA_SIGNED_URL_SECONDS);
  if (result.error) throw new MediaStorageError(`Could not create media delivery URLs: ${result.error.message}`);
  const urls = new Map<string, string>();
  result.data.forEach((item) => {
    if (!item.path || !item.signedUrl) throw new MediaStorageError(`Could not sign media path: ${item.path ?? "unknown"}`);
    urls.set(item.path, item.signedUrl);
  });
  if (urls.size !== paths.length) throw new MediaStorageError("One or more processed media URLs could not be signed");
  return urls;
}

export async function removePrivateObjects(bucket: string, paths: string[]) {
  if (!paths.length) return;
  const result = await createAdminClient().storage.from(bucket).remove(paths);
  if (result.error) throw new MediaStorageError(`Could not remove media objects: ${result.error.message}`);
}
