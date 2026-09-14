import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@/db";
import type { Actor } from "@/lib/auth/permissions";
import { getEventBrief, saveEventBrief, submitEventBrief } from "@/lib/content/service";
import { demoEvents } from "@/lib/demo-data";
import { createJobOrder, getJobOrder } from "@/lib/orders/service";
import {
  approveReviewVersion, changeInvitationAvailability, createReviewVersion, getReviewVersion, listReviewHistory,
  PublicationBlockedError, publishApprovedVersion, requestReviewChanges, ReviewAuthorizationError, ReviewConflictError, rollbackApprovedVersion,
} from "@/lib/reviews/service";
import { getStudioOrder, saveDraftOverrides, StudioConflictError } from "@/lib/studio/service";

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) throw new Error("Review integration tests require MIGRATION_DATABASE_URL");
const adminSql = postgres(migrationUrl, { max: 1, prepare: false });
const fixture = {
  adminId: randomUUID(), adminAuthId: randomUUID(), designerId: randomUUID(), designerAuthId: randomUUID(),
  customerId: randomUUID(), customerAuthId: randomUUID(), otherId: randomUUID(), otherAuthId: randomUUID(), packageId: randomUUID(),
};
const adminActor: Actor = { accountId: fixture.adminId, accountType: "STAFF", roles: ["ADMIN"] };
const designerActor: Actor = { accountId: fixture.designerId, accountType: "STAFF", roles: ["DESIGNER"] };
const customerActor: Actor = { accountId: fixture.customerId, accountType: "CUSTOMER", roles: [] };
const otherActor: Actor = { accountId: fixture.otherId, accountType: "CUSTOMER", roles: [] };
let orderId: string;
let invitationId: string;
let firstVersionId: string;
let secondVersionId: string;

beforeAll(async () => {
  await adminSql.begin(async (sql) => {
    await sql`insert into accounts (id, auth_user_id, type, display_name, email) values
      (${fixture.adminId}, ${fixture.adminAuthId}, 'STAFF', 'Phase 5 Admin', ${`phase5-admin-${fixture.adminId}@example.test`}),
      (${fixture.designerId}, ${fixture.designerAuthId}, 'STAFF', 'Phase 5 Designer', ${`phase5-designer-${fixture.designerId}@example.test`}),
      (${fixture.customerId}, ${fixture.customerAuthId}, 'CUSTOMER', 'Phase 5 Customer', ${`phase5-customer-${fixture.customerId}@example.test`}),
      (${fixture.otherId}, ${fixture.otherAuthId}, 'CUSTOMER', 'Other Customer', ${`phase5-other-${fixture.otherId}@example.test`})`;
    await sql`insert into staff_memberships (account_id, role) values (${fixture.adminId}, 'ADMIN'), (${fixture.designerId}, 'DESIGNER')`;
    await sql`insert into packages (id, code, name, terms_snapshot) values (${fixture.packageId}, ${`PHASE5-${fixture.packageId}`}, 'Phase 5 Package', '{}')`;
  });
  const event = { ...demoEvents.wedding, id: randomUUID(), activities: demoEvents.wedding.activities.map((activity) => ({ ...activity, id: randomUUID() })) };
  const order = await createJobOrder(adminActor, {
    customerId: fixture.customerId, assignedDesignerId: fixture.designerId, packageId: fixture.packageId,
    currency: "PHP", quotedAmountMinor: 200000, depositRequiredMinor: 100000, dueDate: "2026-10-31",
    collectionKey: "midnight-garden", event,
  }, { jobNumberYear: 2095 });
  orderId = order.id;
  await adminSql`insert into payment_entries (job_order_id, amount_minor, currency, method, confirmed_by, idempotency_key) values (${orderId}, 100000, 'PHP', 'bank-transfer', ${fixture.adminId}, ${randomUUID()})`;
  const brief = await getEventBrief(customerActor, orderId);
  await submitEventBrief(customerActor, orderId, { expectedRevision: brief.revision });
});

afterAll(async () => {
  await closeDb();
  await adminSql.begin(async (sql) => {
    await sql`delete from audit_events where actor_account_id in (${fixture.adminId}, ${fixture.designerId}, ${fixture.customerId}, ${fixture.otherId})`;
    await sql`delete from review_requests where requested_by = ${fixture.customerId}`;
    await sql`delete from approvals where customer_id = ${fixture.customerId}`;
    await sql`delete from background_jobs where kind = 'SEND_EMAIL' and payload->>'deliveryId' in (select id::text from notification_deliveries where job_order_id = ${orderId})`;
    await sql`delete from notification_deliveries where job_order_id = ${orderId}`;
    await sql`delete from payment_entries where job_order_id = ${orderId}`;
    await sql`delete from deletion_records where job_order_id = ${orderId}`;
    await sql`delete from job_orders where id = ${orderId}`;
    await sql`delete from packages where id = ${fixture.packageId}`;
    await sql`delete from staff_memberships where account_id in (${fixture.adminId}, ${fixture.designerId})`;
    await sql`delete from accounts where id in (${fixture.adminId}, ${fixture.designerId}, ${fixture.customerId}, ${fixture.otherId})`;
    await sql`delete from job_order_counters where year = 2095`;
  });
  await adminSql.end({ timeout: 5 });
});

describe.sequential("Phase 5 review and publishing", () => {
  it("freezes an exact review and records one consolidated change request", async () => {
    const studio = await getStudioOrder(designerActor, orderId);
    const review = await createReviewVersion(designerActor, orderId, { expectedRevision: studio.draft.revision, checklist: { contentVerified: true, responsiveChecked: true, accessibilityChecked: true, mediaChecked: true } });
    invitationId = review.invitation.id; firstVersionId = review.version.id;
    expect(review).toMatchObject({ version: { number: 1, sourceRevision: studio.draft.revision }, reviewState: "IN_REVIEW", current: true });
    expect(review.version.contentHash).toMatch(/^[0-9a-f]{64}$/);
    await expect(getReviewVersion(otherActor, firstVersionId)).rejects.toBeInstanceOf(ReviewAuthorizationError);
    await expect(saveDraftOverrides(designerActor, orderId, { expectedRevision: studio.draft.revision, typography: "editorial-serif" })).rejects.toBeInstanceOf(StudioConflictError);
    const changed = await requestReviewChanges(customerActor, firstVersionId, { summary: "Please adjust the opening", items: [{ sectionKey: "opening", message: "Use the editorial typography preset." }] });
    expect(changed).toMatchObject({ reviewState: "CHANGES_REQUESTED", changeRequest: { summary: "Please adjust the opening" } });
  });

  it("creates and approves a new exact version after revisions", async () => {
    const studio = await getStudioOrder(designerActor, orderId);
    const saved = await saveDraftOverrides(designerActor, orderId, { expectedRevision: studio.draft.revision, typography: "editorial-serif" });
    const review = await createReviewVersion(designerActor, orderId, { expectedRevision: saved.draft.revision, checklist: { contentVerified: true, responsiveChecked: true, accessibilityChecked: true, mediaChecked: true } });
    secondVersionId = review.version.id;
    expect(review.version.number).toBe(2);
    await expect(adminSql`insert into approvals (version_id, customer_id) values (${secondVersionId}, ${fixture.otherId})`).rejects.toThrow(/does not own/);
    const approved = await approveReviewVersion(customerActor, secondVersionId);
    expect(approved).toMatchObject({ reviewState: "APPROVED", approval: { customerId: fixture.customerId } });
    await expect(approveReviewVersion(customerActor, firstVersionId)).rejects.toBeInstanceOf(ReviewConflictError);
  });

  it("enforces payment and publishes only the current approved version", async () => {
    await expect(publishApprovedVersion(adminActor, invitationId, { versionId: secondVersionId })).rejects.toBeInstanceOf(PublicationBlockedError);
    await adminSql`insert into payment_entries (job_order_id, amount_minor, currency, method, confirmed_by, idempotency_key) values (${orderId}, 100000, 'PHP', 'bank-transfer', ${fixture.adminId}, ${randomUUID()})`;
    const published = await publishApprovedVersion(adminActor, invitationId, { versionId: secondVersionId });
    expect(published.invitation).toMatchObject({ liveVersionId: secondVersionId, availability: "LIVE" });
    expect((await getJobOrder(adminActor, orderId)).state).toBe("DELIVERED");
  });

  it("publishes material corrections and safely rolls back", async () => {
    const brief = await getEventBrief(customerActor, orderId);
    const changedDocument = structuredClone(brief.document);
    changedDocument.event.activities[0].venueName = "Corrected ceremony venue";
    const saved = await saveEventBrief(customerActor, orderId, { expectedRevision: brief.revision, document: changedDocument });
    const unsubmittedStudio = await getStudioOrder(designerActor, orderId);
    await expect(createReviewVersion(designerActor, orderId, {
      expectedRevision: unsubmittedStudio.draft.revision,
      checklist: { contentVerified: true, responsiveChecked: true, accessibilityChecked: true, mediaChecked: true },
    })).rejects.toBeInstanceOf(ReviewConflictError);
    await submitEventBrief(customerActor, orderId, { expectedRevision: saved.revision });
    expect((await getJobOrder(adminActor, orderId)).state).toBe("DELIVERED");
    const studio = await getStudioOrder(designerActor, orderId);
    const review = await createReviewVersion(designerActor, orderId, { expectedRevision: studio.draft.revision, checklist: { contentVerified: true, responsiveChecked: true, accessibilityChecked: true, mediaChecked: true } });
    expect(review.version.materialChanges).toContainEqual(expect.objectContaining({ kind: "schedule" }));
    await approveReviewVersion(customerActor, review.version.id);
    const republished = await publishApprovedVersion(adminActor, invitationId, { versionId: review.version.id });
    expect(republished.invitation?.liveVersionId).toBe(review.version.id);
    const rolledBack = await rollbackApprovedVersion(adminActor, invitationId, { versionId: secondVersionId });
    expect(rolledBack.invitation?.liveVersionId).toBe(secondVersionId);
  }, 40000);

  it("audits suspension, resumption, expiry, and immediate removal", async () => {
    expect((await changeInvitationAvailability(adminActor, invitationId, { action: "suspend", reason: "Host requested a temporary pause" })).invitation?.availability).toBe("SUSPENDED");
    expect((await changeInvitationAvailability(adminActor, invitationId, { action: "resume", reason: "Host confirmed access may resume" })).invitation?.availability).toBe("LIVE");
    expect((await changeInvitationAvailability(adminActor, invitationId, { action: "expire", reason: "Hosting period ended" })).invitation?.availability).toBe("EXPIRED");
    expect((await changeInvitationAvailability(adminActor, invitationId, { action: "remove", reason: "Customer requested immediate removal" })).invitation?.availability).toBe("REMOVED");
    const auditRows = await adminSql<{ action: string }[]>`select action from audit_events
      where entity_type = 'invitation' and entity_id = ${invitationId}
        and action in ('invitation.suspended', 'invitation.resumed', 'invitation.expired', 'invitation.removed')
      order by created_at`;
    expect(auditRows.map((row) => row.action)).toEqual(["invitation.suspended", "invitation.resumed", "invitation.expired", "invitation.removed"]);
    const [deletion] = await adminSql<{ execute_after: Date }[]>`select execute_after from deletion_records where invitation_id = ${invitationId}`;
    expect(deletion.execute_after.getTime()).toBeLessThanOrEqual(Date.now());
    await expect(publishApprovedVersion(adminActor, invitationId, { versionId: secondVersionId })).rejects.toBeInstanceOf(PublicationBlockedError);
    const history = await listReviewHistory(customerActor, orderId);
    expect(history.versions).toHaveLength(3);
  });
});
