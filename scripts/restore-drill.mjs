import { access, mkdtemp, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import postgres from "postgres";

const sourceUrl = process.env.MIGRATION_DATABASE_URL;
const targetUrl = process.env.RESTORE_DATABASE_URL;
if (!sourceUrl || !targetUrl) throw new Error("MIGRATION_DATABASE_URL and RESTORE_DATABASE_URL are required");
if (process.env.CONFIRM_RESTORE_DRILL !== "RESTORE_DISPOSABLE_DATABASE") throw new Error("Set CONFIRM_RESTORE_DRILL=RESTORE_DISPOSABLE_DATABASE");
const source = new URL(sourceUrl); const target = new URL(targetUrl);
if (`${source.hostname}:${source.port}${source.pathname}` === `${target.hostname}:${target.port}${target.pathname}`) throw new Error("Restore target must differ from the source database");

for (const binary of ["pg_dump", "pg_restore"]) await commandExists(binary);
const directory = await mkdtemp(join(tmpdir(), "maison-restore-"));
const archive = join(directory, "database.dump");
try {
  await run("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", archive, sourceUrl]);
  await run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-acl", "--dbname", targetUrl, archive]);
  const sql = postgres(targetUrl, { max: 1, prepare: false });
  try {
    const replayedTombstones = await replayDeletionTombstones(sql);
    const [tables] = await sql`select count(*)::int total from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'`;
    const [violations] = await sql`select count(*)::int total from deletion_records deletion join invitations invitation on invitation.id = deletion.invitation_id where deletion.content_purged_at is not null`;
    if (tables.total < 36) throw new Error(`Restore has only ${tables.total} public tables`);
    if (violations.total) throw new Error("Restored database resurrected purged invitations; replay deletion tombstones before use");
    console.log(JSON.stringify({ restored: true, publicTables: tables.total, replayedTombstones, purgedInvitationViolations: violations.total }));
  } finally { await sql.end({ timeout: 5 }); }
} finally { await rm(directory, { recursive: true, force: true }); }

async function commandExists(binary) {
  const paths = (process.env.PATH ?? "").split(":");
  for (const path of paths) try { await access(join(path, binary), constants.X_OK); return; } catch {}
  throw new Error(`${binary} is required. Install PostgreSQL client tools before running the drill.`);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject); child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

async function replayDeletionTombstones(sql) {
  const region = process.env.BACKUP_S3_REGION; const bucket = process.env.BACKUP_S3_BUCKET;
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID; const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY;
  if (!region || !bucket || !accessKeyId || !secretAccessKey) throw new Error("Backup S3 configuration is required to replay deletion tombstones");
  const s3 = new S3Client({ region, ...(process.env.BACKUP_S3_ENDPOINT ? { endpoint: process.env.BACKUP_S3_ENDPOINT } : {}), forcePathStyle: process.env.BACKUP_S3_FORCE_PATH_STYLE === "true", credentials: { accessKeyId, secretAccessKey } });
  let continuationToken; let replayed = 0;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: "deletions/", ContinuationToken: continuationToken }));
    for (const item of page.Contents ?? []) {
      if (!item.Key) continue;
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: item.Key }));
      const tombstone = JSON.parse(await object.Body.transformToString());
      if (tombstone.schemaVersion !== 1 || typeof tombstone.invitationId !== "string" || typeof tombstone.jobOrderId !== "string") throw new Error(`Invalid deletion tombstone ${item.Key}`);
      await sql.begin(async (transaction) => {
        await transaction`insert into deletion_records (id, job_order_id, invitation_id, slug_digest, reason, requested_at, execute_after, content_purged_at, tombstone_exported_at)
          values (${tombstone.deletionRecordId}, ${tombstone.jobOrderId}, ${tombstone.invitationId}, ${tombstone.slugDigest}, 'Replayed after restore', ${tombstone.requestedAt}, ${tombstone.executeAfter}, now(), now())
          on conflict (invitation_id) do update set content_purged_at = now(), tombstone_exported_at = now()`;
        await transaction`delete from approvals where version_id in (select id from invitation_versions where invitation_id = ${tombstone.invitationId})`;
        await transaction`delete from review_requests where version_id in (select id from invitation_versions where invitation_id = ${tombstone.invitationId})`;
        await transaction`delete from invitations where id = ${tombstone.invitationId}`;
        await transaction`delete from event_briefs where job_order_id = ${tombstone.jobOrderId}`;
        await transaction`delete from events where job_order_id = ${tombstone.jobOrderId}`;
        await transaction`delete from background_jobs where kind = 'SEND_EMAIL' and payload->>'deliveryId' in (select id::text from notification_deliveries where job_order_id = ${tombstone.jobOrderId})`;
        await transaction`delete from notification_deliveries where job_order_id = ${tombstone.jobOrderId}`;
        await transaction`update media_objects set state = 'DELETED', original_filename = 'deleted', claimed_content_type = null, deleted_at = now(), updated_at = now() where job_order_id = ${tombstone.jobOrderId} and usage <> 'CATALOG_ARTWORK'`;
        await transaction`update job_orders set state = 'CLOSED', assigned_designer_id = null, submitted_at = null, updated_at = now() where id = ${tombstone.jobOrderId}`;
      });
      replayed += 1;
    }
    continuationToken = page.NextContinuationToken;
  } while (continuationToken);
  s3.destroy();
  return replayed;
}
