import "server-only";

import { DeleteObjectsCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let client: S3Client | undefined;

function config() {
  const endpoint = process.env.BACKUP_S3_ENDPOINT;
  const region = process.env.BACKUP_S3_REGION;
  const bucket = process.env.BACKUP_S3_BUCKET;
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY;
  if (!region || !bucket || !accessKeyId || !secretAccessKey) throw new Error("BACKUP_NOT_CONFIGURED");
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

function getClient() {
  const value = config();
  client ??= new S3Client({
    region: value.region,
    ...(value.endpoint ? { endpoint: value.endpoint } : {}),
    forcePathStyle: process.env.BACKUP_S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: value.accessKeyId, secretAccessKey: value.secretAccessKey },
  });
  return { client, bucket: value.bucket };
}

export async function putVerifiedBackupObject(key: string, body: Buffer, contentType: string, checksum: string) {
  const { client: s3, bucket } = getClient();
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: body, ContentType: contentType,
    Metadata: { sha256: checksum },
  }));
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (Number(head.ContentLength) !== body.length || head.Metadata?.sha256 !== checksum) throw new Error("BACKUP_VERIFICATION_FAILED");
  return { key, bytes: body.length, checksum, contentType };
}

export function backupConfigurationReady() {
  try { config(); return true; } catch { return false; }
}

export async function removeBackupPrefix(prefix: string) {
  const { client: s3, bucket } = getClient();
  let continuationToken: string | undefined;
  let deleted = 0;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `${prefix}/`, ContinuationToken: continuationToken }));
    const objects = (page.Contents ?? []).flatMap((item) => item.Key ? [{ Key: item.Key }] : []);
    if (objects.length) {
      await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects, Quiet: true } }));
      deleted += objects.length;
    }
    continuationToken = page.NextContinuationToken;
  } while (continuationToken);
  return deleted;
}
