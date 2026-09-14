import { randomUUID } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@/db";
import type { Actor } from "@/lib/auth/permissions";
import {
  createMediaUploadIntent,
  finalizeMediaUpload,
  getMediaDelivery,
  getMediaStatus,
  MediaAuthorizationError,
  resolveMediaReferences,
} from "@/lib/media/service";
import { ensureMediaBuckets } from "@/lib/media/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanupMediaStorage, runMediaWorker } from "@/lib/media/worker";

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Media integration tests require database and Supabase environment variables");
}

const adminSql = postgres(migrationUrl, { max: 1, prepare: false });
const fixture = {
  customerId: randomUUID(),
  customerAuthId: randomUUID(),
  otherCustomerId: randomUUID(),
  otherCustomerAuthId: randomUUID(),
  packageId: randomUUID(),
  orderId: randomUUID(),
  otherOrderId: randomUUID(),
  invitationId: randomUUID(),
  otherInvitationId: randomUUID(),
  versionId: randomUUID(),
  otherVersionId: randomUUID(),
  invalidJobId: randomUUID(),
};
const customerActor: Actor = { accountId: fixture.customerId, accountType: "CUSTOMER", roles: [] };
const otherCustomerActor: Actor = { accountId: fixture.otherCustomerId, accountType: "CUSTOMER", roles: [] };
const createdMediaIds: string[] = [];

beforeAll(async () => {
  await ensureMediaBuckets();
  await adminSql.begin(async (sql) => {
    await sql`
      insert into accounts (id, auth_user_id, type, display_name, email)
      values
        (${fixture.customerId}, ${fixture.customerAuthId}, 'CUSTOMER', 'Phase 3 Customer', ${`phase3-${fixture.customerId}@example.test`}),
        (${fixture.otherCustomerId}, ${fixture.otherCustomerAuthId}, 'CUSTOMER', 'Phase 3 Other', ${`phase3-${fixture.otherCustomerId}@example.test`})
    `;
    await sql`insert into packages (id, code, name, terms_snapshot) values (${fixture.packageId}, ${`PHASE3-${fixture.packageId}`}, 'Phase 3 Package', '{}')`;
    await sql`
      insert into job_orders (id, job_number, customer_id, package_id, currency, quoted_amount_minor, deposit_required_minor)
      values
        (${fixture.orderId}, ${`JO-PHASE3-${fixture.orderId}`}, ${fixture.customerId}, ${fixture.packageId}, 'PHP', 10000, 5000),
        (${fixture.otherOrderId}, ${`JO-PHASE3-${fixture.otherOrderId}`}, ${fixture.otherCustomerId}, ${fixture.packageId}, 'PHP', 10000, 5000)
    `;
  });
});

afterAll(async () => {
  await closeDb();
  const media = createdMediaIds.length
    ? await adminSql<{ id: string; bucket: string; storage_key: string; quarantine_storage_key: string | null }[]>`
        select id, bucket, storage_key, quarantine_storage_key from media_objects where id in ${adminSql(createdMediaIds)}
      `
    : [];
  const variants = createdMediaIds.length
    ? await adminSql<{ bucket: string; storage_key: string }[]>`select bucket, storage_key from media_variants where source_media_id in ${adminSql(createdMediaIds)}`
    : [];
  const storage = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!).storage;
  const objects = new Map<string, Set<string>>();
  for (const item of media) {
    objects.set(item.bucket, (objects.get(item.bucket) ?? new Set()).add(item.storage_key));
    if (item.quarantine_storage_key) objects.set("maison-quarantine", (objects.get("maison-quarantine") ?? new Set()).add(item.quarantine_storage_key));
  }
  for (const item of variants) objects.set(item.bucket, (objects.get(item.bucket) ?? new Set()).add(item.storage_key));
  for (const [bucket, paths] of objects) await storage.from(bucket).remove([...paths]);

  await adminSql.begin(async (sql) => {
    await sql`delete from version_media_refs where version_id in (${fixture.versionId}, ${fixture.otherVersionId})`;
    await sql`delete from invitation_versions where id in (${fixture.versionId}, ${fixture.otherVersionId})`;
    await sql`delete from invitations where id in (${fixture.invitationId}, ${fixture.otherInvitationId})`;
    await sql`delete from background_jobs where id = ${fixture.invalidJobId}`;
    if (createdMediaIds.length) {
      await sql`delete from audit_events where actor_account_id in (${fixture.customerId}, ${fixture.otherCustomerId}) or entity_id in ${sql(createdMediaIds)}`;
      await sql`delete from background_jobs where payload->>'mediaId' in ${sql(createdMediaIds)}`;
      await sql`delete from media_variants where source_media_id in ${sql(createdMediaIds)}`;
      await sql`delete from media_objects where id in ${sql(createdMediaIds)}`;
    } else {
      await sql`delete from audit_events where actor_account_id in (${fixture.customerId}, ${fixture.otherCustomerId})`;
    }
    await sql`delete from job_orders where id in (${fixture.orderId}, ${fixture.otherOrderId})`;
    await sql`delete from packages where id = ${fixture.packageId}`;
    await sql`delete from accounts where id in (${fixture.customerId}, ${fixture.otherCustomerId})`;
  });
  await adminSql.end({ timeout: 5 });
});

describe.sequential("production media pipeline", () => {
  let readyMediaId: string;

  it("uploads directly with a signed token, processes variants, and signs authorized delivery", async () => {
    const image = await sharp({ create: { width: 1280, height: 853, channels: 3, background: "#a95d78" } }).jpeg({ quality: 88 }).toBuffer();
    const intent = await createMediaUploadIntent(customerActor, {
      jobOrderId: fixture.orderId,
      idempotencyKey: randomUUID(),
      filename: "portrait.jpg",
      contentType: "image/jpeg",
      bytes: image.length,
    });
    readyMediaId = intent.mediaId;
    createdMediaIds.push(readyMediaId);

    const browser = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    const uploaded = await browser.storage.from(intent.bucket).uploadToSignedUrl(intent.path, intent.token, image, {
      contentType: "image/jpeg",
      cacheControl: "0",
    });
    expect(uploaded.error).toBeNull();
    await expect(finalizeMediaUpload(customerActor, readyMediaId)).resolves.toMatchObject({ state: "QUARANTINED" });

    const worker = await runMediaWorker("phase-3-integration", 2);
    expect(worker.results).toContainEqual(expect.objectContaining({ mediaId: readyMediaId, outcome: "READY" }));
    const status = await getMediaStatus(customerActor, readyMediaId);
    expect(status).toMatchObject({ state: "READY", width: 1280, height: 853, failureCode: null });
    const [backup] = await adminSql<{ state: string; job_state: string }[]>`select backup.state, job.state as job_state from media_backups backup join background_jobs job on job.payload->>'mediaId' = backup.media_id::text and job.kind = 'BACKUP_MEDIA' where backup.media_id = ${readyMediaId}`;
    expect(backup).toEqual({ state: "PENDING", job_state: "PENDING" });
    await expect(getMediaStatus(otherCustomerActor, readyMediaId)).rejects.toBeInstanceOf(MediaAuthorizationError);

    const delivery = await getMediaDelivery(customerActor, readyMediaId, 900);
    expect(delivery).toMatchObject({ width: 960, contentType: "image/webp", expiresInSeconds: 300 });
    const response = await fetch(delivery.src);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/webp");

    const [resolved] = await resolveMediaReferences(customerActor, fixture.orderId, [{ mediaId: readyMediaId, alt: "Portrait" }]);
    expect(resolved.sources.length).toBeGreaterThanOrEqual(2);
    expect(resolved.alt).toBe("Portrait");
  });

  it("rejects malformed image bytes without retrying the durable job", async () => {
    const malformed = Buffer.from("definitely-not-an-image");
    const intent = await createMediaUploadIntent(customerActor, {
      jobOrderId: fixture.orderId,
      idempotencyKey: randomUUID(),
      filename: "broken.png",
      contentType: "image/png",
      bytes: malformed.length,
    });
    createdMediaIds.push(intent.mediaId);
    const browser = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    const uploaded = await browser.storage.from(intent.bucket).uploadToSignedUrl(intent.path, intent.token, malformed, { contentType: "image/png", cacheControl: "0" });
    expect(uploaded.error).toBeNull();
    await finalizeMediaUpload(customerActor, intent.mediaId);
    const worker = await runMediaWorker("phase-3-integration", 2);
    expect(worker.results).toContainEqual(expect.objectContaining({ mediaId: intent.mediaId, outcome: "REJECTED" }));
    await expect(getMediaStatus(customerActor, intent.mediaId)).resolves.toMatchObject({ state: "REJECTED", failureCode: "MALFORMED_IMAGE" });
  });

  it("enforces media ownership and retained-version deletion in PostgreSQL", async () => {
    await adminSql.begin(async (sql) => {
      await sql`
        insert into invitations (id, job_order_id, slug, expires_at)
        values
          (${fixture.invitationId}, ${fixture.orderId}, ${`phase3-${fixture.invitationId}`}, now() + interval '1 year'),
          (${fixture.otherInvitationId}, ${fixture.otherOrderId}, ${`phase3-${fixture.otherInvitationId}`}, now() + interval '1 year')
      `;
      await sql`
        insert into invitation_versions (id, invitation_id, version, source_revision, snapshot, content_hash, renderer_version, created_by)
        values
          (${fixture.versionId}, ${fixture.invitationId}, 1, 1, '{}', ${"a".repeat(64)}, 'v1', ${fixture.customerId}),
          (${fixture.otherVersionId}, ${fixture.otherInvitationId}, 1, 1, '{}', ${"b".repeat(64)}, 'v1', ${fixture.otherCustomerId})
      `;
    });

    await expect(adminSql`insert into version_media_refs (version_id, media_id) values (${fixture.otherVersionId}, ${readyMediaId})`)
      .rejects.toThrow("crosses an order or customer boundary");
    await adminSql`insert into version_media_refs (version_id, media_id) values (${fixture.versionId}, ${readyMediaId})`;
    await expect(adminSql`update media_objects set state = 'DELETED' where id = ${readyMediaId}`)
      .rejects.toThrow("cannot be deleted");
  });

  it("removes abandoned quarantine uploads through an idempotent cleanup sweep", async () => {
    const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#efe3d5" } }).png().toBuffer();
    const intent = await createMediaUploadIntent(customerActor, {
      jobOrderId: fixture.orderId,
      idempotencyKey: randomUUID(),
      filename: "abandoned.png",
      contentType: "image/png",
      bytes: bytes.length,
    });
    createdMediaIds.push(intent.mediaId);
    const browser = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    const uploaded = await browser.storage.from(intent.bucket).uploadToSignedUrl(intent.path, intent.token, bytes, { contentType: "image/png", cacheControl: "0" });
    expect(uploaded.error).toBeNull();

    const cleanup = await cleanupMediaStorage(new Date(Date.now() + 49 * 60 * 60 * 1000), 20);
    expect(cleanup.deleted).toContain(intent.mediaId);
    await expect(getMediaStatus(customerActor, intent.mediaId)).resolves.toMatchObject({ state: "DELETED" });
    const [deletedMedia] = await adminSql<{ storage_purged_at: Date | null }[]>`
      select storage_purged_at from media_objects where id = ${intent.mediaId}
    `;
    expect(deletedMedia.storage_purged_at).toBeInstanceOf(Date);
    const storageInfo = await createAdminClient().storage.from(intent.bucket).info(intent.path);
    expect(storageInfo.data).toBeNull();
    expect(storageInfo.error).not.toBeNull();
  });

  it("leases invalid job payloads and schedules bounded retries", async () => {
    await adminSql`
      insert into background_jobs (id, kind, payload, idempotency_key)
      values (${fixture.invalidJobId}, 'PROCESS_MEDIA', '{}', ${`phase3-invalid-${fixture.invalidJobId}`})
    `;
    const result = await runMediaWorker("phase-3-integration", 1);
    expect(result.results[0]).toMatchObject({ jobId: fixture.invalidJobId, outcome: "RETRY_SCHEDULED", errorCode: "INVALID_JOB_PAYLOAD" });
    const [job] = await adminSql<{ state: string; attempts: number; last_error_code: string }[]>`
      select state, attempts, last_error_code from background_jobs where id = ${fixture.invalidJobId}
    `;
    expect(job).toEqual({ state: "PENDING", attempts: 1, last_error_code: "INVALID_JOB_PAYLOAD" });
  });
});
