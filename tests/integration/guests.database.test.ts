import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@/db";
import type { Actor } from "@/lib/auth/permissions";
import { getEventBrief, submitEventBrief } from "@/lib/content/service";
import { demoEvents } from "@/lib/demo-data";
import {
  correctHouseholdRsvp, createHousehold, exchangeGuestLink, exportHouseholdCsv, getGuestInvitation,
  GuestAuthorizationError, GuestConflictError, listHouseholds, revokeHouseholdLink, rotateHouseholdLink,
  submitGuestRsvp, updateHousehold,
} from "@/lib/guests/service";
import { createJobOrder } from "@/lib/orders/service";
import { approveReviewVersion, createReviewVersion, publishApprovedVersion } from "@/lib/reviews/service";
import { getStudioOrder } from "@/lib/studio/service";

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) throw new Error("Guest integration tests require MIGRATION_DATABASE_URL");
const adminSql = postgres(migrationUrl, { max: 1, prepare: false });
const fixture = {
  adminId: randomUUID(), adminAuthId: randomUUID(), designerId: randomUUID(), designerAuthId: randomUUID(),
  customerId: randomUUID(), customerAuthId: randomUUID(), otherId: randomUUID(), otherAuthId: randomUUID(), packageId: randomUUID(),
};
const adminActor: Actor = { accountId: fixture.adminId, accountType: "STAFF", roles: ["ADMIN"] };
const designerActor: Actor = { accountId: fixture.designerId, accountType: "STAFF", roles: ["DESIGNER"] };
const customerActor: Actor = { accountId: fixture.customerId, accountType: "CUSTOMER", roles: [] };
const otherActor: Actor = { accountId: fixture.otherId, accountType: "CUSTOMER", roles: [] };
let orderId = "";
let slug = "";
let groupId = "";
let sessionToken = "";
let linkToken = "";

beforeAll(async () => {
  await adminSql.begin(async (sql) => {
    await sql`insert into accounts (id, auth_user_id, type, display_name, email) values
      (${fixture.adminId}, ${fixture.adminAuthId}, 'STAFF', 'Phase 6 Admin', ${`phase6-admin-${fixture.adminId}@example.test`}),
      (${fixture.designerId}, ${fixture.designerAuthId}, 'STAFF', 'Phase 6 Designer', ${`phase6-designer-${fixture.designerId}@example.test`}),
      (${fixture.customerId}, ${fixture.customerAuthId}, 'CUSTOMER', 'Phase 6 Customer', ${`phase6-customer-${fixture.customerId}@example.test`}),
      (${fixture.otherId}, ${fixture.otherAuthId}, 'CUSTOMER', 'Other Customer', ${`phase6-other-${fixture.otherId}@example.test`})`;
    await sql`insert into staff_memberships (account_id, role) values (${fixture.adminId}, 'ADMIN'), (${fixture.designerId}, 'DESIGNER')`;
    await sql`insert into packages (id, code, name, terms_snapshot) values (${fixture.packageId}, ${`PHASE6-${fixture.packageId}`}, 'Phase 6 Package', '{}')`;
  });
  const event = {
    ...demoEvents.wedding,
    id: randomUUID(),
    primaryLocalDate: "2094-09-20",
    rsvpDeadline: "2094-08-20",
    activities: demoEvents.wedding.activities.map((activity) => ({ ...activity, id: randomUUID(), startsAt: "2094-09-20T07:00:00.000Z" })),
  };
  const order = await createJobOrder(adminActor, {
    customerId: fixture.customerId, assignedDesignerId: fixture.designerId, packageId: fixture.packageId,
    currency: "PHP", quotedAmountMinor: 200000, depositRequiredMinor: 100000, dueDate: "2094-08-01", collectionKey: "midnight-garden", event,
  }, { jobNumberYear: 2094 });
  orderId = order.id;
  await adminSql`insert into payment_entries (job_order_id, amount_minor, currency, method, confirmed_by, idempotency_key) values (${orderId}, 200000, 'PHP', 'bank-transfer', ${fixture.adminId}, ${randomUUID()})`;
  const brief = await getEventBrief(customerActor, orderId);
  await submitEventBrief(customerActor, orderId, { expectedRevision: brief.revision });
  const studio = await getStudioOrder(designerActor, orderId);
  const review = await createReviewVersion(designerActor, orderId, { expectedRevision: studio.draft.revision, checklist: { contentVerified: true, responsiveChecked: true, accessibilityChecked: true, mediaChecked: true } });
  await approveReviewVersion(customerActor, review.version.id);
  await publishApprovedVersion(adminActor, review.invitation.id, { versionId: review.version.id });
}, 60_000);

afterAll(async () => {
  await closeDb();
  await adminSql.begin(async (sql) => {
    await sql`delete from audit_events where actor_account_id in (${fixture.adminId}, ${fixture.designerId}, ${fixture.customerId}, ${fixture.otherId}) or (entity_type = 'guest_group' and entity_id in (select id from guest_groups where invitation_id in (select id from invitations where job_order_id = ${orderId})))`;
    await sql`delete from approvals where version_id in (select version.id from invitation_versions version join invitations invitation on invitation.id = version.invitation_id where invitation.job_order_id = ${orderId})`;
    await sql`delete from background_jobs where kind = 'SEND_EMAIL' and payload->>'deliveryId' in (select id::text from notification_deliveries where job_order_id = ${orderId})`;
    await sql`delete from notification_deliveries where job_order_id = ${orderId}`;
    await sql`delete from payment_entries where job_order_id = ${orderId}`;
    await sql`delete from job_orders where id = ${orderId}`;
    await sql`delete from packages where id = ${fixture.packageId}`;
    await sql`delete from staff_memberships where account_id in (${fixture.adminId}, ${fixture.designerId})`;
    await sql`delete from accounts where id in (${fixture.adminId}, ${fixture.designerId}, ${fixture.customerId}, ${fixture.otherId})`;
    await sql`delete from job_order_counters where year = 2094`;
  });
  await adminSql.end({ timeout: 5 });
}, 60_000);

describe.sequential("Phase 6 household invitations and RSVP", () => {
  it("issues a reusable household link and exchanges it for private sessions", async () => {
    const list = await createHousehold(customerActor, orderId, { label: "=Santos family", slots: [
      { type: "ADULT", assignedName: "Ana Santos", isAdditionalGuest: false },
      { type: "ADULT", assignedName: null, isAdditionalGuest: true },
      { type: "CHILD", assignedName: null, isAdditionalGuest: false },
    ] });
    const household = list.households[0];
    groupId = household.id;
    const [path, fragment] = household.link!.url.split("#");
    slug = new URL(path).pathname.split("/").at(-1)!;
    linkToken = new URLSearchParams(fragment).get("invite")!;
    sessionToken = (await exchangeGuestLink(slug, linkToken, `phase6:${randomUUID()}`)).token;
    const forwardedSession = await exchangeGuestLink(slug, linkToken, `phase6:${randomUUID()}`);
    expect(forwardedSession.token).not.toBe(sessionToken);
    const guest = await getGuestInvitation(slug, sessionToken);
    expect(guest).toMatchObject({ household: { id: groupId, label: "=Santos family" }, rsvpOpen: true, invitation: { version: 1 } });
    await expect(listHouseholds(otherActor, orderId)).rejects.toThrow(/not found/i);
  });

  it("saves an idempotent response and rejects stale or foreign-seat writes", async () => {
    const guest = await getGuestInvitation(slug, sessionToken);
    const [assigned, additional] = guest.household.slots;
    const idempotencyKey = randomUUID();
    const input = { status: "ATTENDING" as const, selectedSlotIds: [assigned.id, additional.id], attendeeNames: { [additional.id]: "Luis Cruz" }, note: "Vegetarian meal, please", expectedRevision: 0, invitationVersion: 1, idempotencyKey, website: "" };
    const saved = await submitGuestRsvp(slug, sessionToken, input);
    expect(saved.response).toMatchObject({ status: "ATTENDING", revision: 1 });
    expect(saved.response?.attendees).toHaveLength(2);
    expect((await submitGuestRsvp(slug, sessionToken, input)).response?.revision).toBe(1);
    await expect(submitGuestRsvp(slug, sessionToken, { ...input, idempotencyKey: randomUUID() })).rejects.toBeInstanceOf(GuestConflictError);

    const host = await listHouseholds(customerActor, orderId);
    const household = host.households.find((item) => item.id === groupId)!;
    await expect(updateHousehold(customerActor, orderId, groupId, { label: household.label, active: true, expectedRevision: household.revision, slots: household.slots.slice(1).map(({ id, type, assignedName, isAdditionalGuest }) => ({ id, type, assignedName, isAdditionalGuest })) })).rejects.toBeInstanceOf(GuestConflictError);
    const second = await createHousehold(customerActor, orderId, { label: "Other family", slots: [{ type: "ADULT", assignedName: "Other Guest", isAdditionalGuest: false }] });
    const otherGroup = second.households.find((item) => item.id !== groupId)!;
    const [{ id: rsvpId }] = await adminSql<{ id: string }[]>`select id from rsvps where group_id = ${groupId}`;
    await expect(adminSql`insert into rsvp_attendees (rsvp_id, slot_id) values (${rsvpId}, ${otherGroup.slots[0].id})`).rejects.toThrow(/response household/);
  });

  it("exports safely, allows audited correction, and revokes prior sessions on rotation", async () => {
    const csv = await exportHouseholdCsv(customerActor, orderId);
    expect(csv).toContain("'=Santos family");
    const corrected = await correctHouseholdRsvp(adminActor, orderId, groupId, { status: "DECLINED", selectedSlotIds: [], attendeeNames: {}, reason: "Host confirmed by telephone" });
    expect(corrected.households.find((item) => item.id === groupId)?.response?.status).toBe("DECLINED");

    const rotated = await rotateHouseholdLink(customerActor, orderId, groupId, { reason: "Original link was forwarded outside the household" });
    await expect(getGuestInvitation(slug, sessionToken)).rejects.toBeInstanceOf(GuestAuthorizationError);
    await expect(exchangeGuestLink(slug, linkToken, `phase6:${randomUUID()}`)).rejects.toBeInstanceOf(GuestAuthorizationError);
    const newToken = new URLSearchParams(rotated.households.find((item) => item.id === groupId)!.link!.url.split("#")[1]).get("invite")!;
    const newSession = await exchangeGuestLink(slug, newToken, `phase6:${randomUUID()}`);
    expect((await getGuestInvitation(slug, newSession.token)).response?.status).toBe("DECLINED");
    await adminSql`update events set rsvp_deadline = '2000-01-01' where job_order_id = ${orderId}`;
    await expect(submitGuestRsvp(slug, newSession.token, { status: "DECLINED", selectedSlotIds: [], attendeeNames: {}, expectedRevision: 2, invitationVersion: 1, idempotencyKey: randomUUID(), website: "" })).rejects.toThrow(/deadline has passed/i);
    await revokeHouseholdLink(customerActor, orderId, groupId, { reason: "Host removed access" });
    await expect(getGuestInvitation(slug, newSession.token)).rejects.toBeInstanceOf(GuestAuthorizationError);
  });
});
