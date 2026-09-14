import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@/db";
import type { Actor } from "@/lib/auth/permissions";
import { ContentAuthorizationError, ContentConflictError, getEventBrief, saveEventBrief, submitEventBrief } from "@/lib/content/service";
import { demoEvents } from "@/lib/demo-data";
import { createJobOrder, getJobOrder } from "@/lib/orders/service";
import { getStudioOrder, saveDraftOverrides, StudioAuthorizationError, StudioConflictError } from "@/lib/studio/service";

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) throw new Error("Production-slice integration tests require MIGRATION_DATABASE_URL");
const adminSql = postgres(migrationUrl, { max: 1, prepare: false });
const fixture = {
  adminId: randomUUID(), adminAuthId: randomUUID(), designerId: randomUUID(), designerAuthId: randomUUID(),
  customerId: randomUUID(), customerAuthId: randomUUID(), packageId: randomUUID(),
};
const adminActor: Actor = { accountId: fixture.adminId, accountType: "STAFF", roles: ["ADMIN"] };
const designerActor: Actor = { accountId: fixture.designerId, accountType: "STAFF", roles: ["DESIGNER"] };
const customerActor: Actor = { accountId: fixture.customerId, accountType: "CUSTOMER", roles: [] };
let orderId: string;

beforeAll(async () => {
  await adminSql.begin(async (sql) => {
    await sql`insert into accounts (id, auth_user_id, type, display_name, email) values
      (${fixture.adminId}, ${fixture.adminAuthId}, 'STAFF', 'Phase 4 Admin', ${`phase4-admin-${fixture.adminId}@example.test`}),
      (${fixture.designerId}, ${fixture.designerAuthId}, 'STAFF', 'Phase 4 Designer', ${`phase4-designer-${fixture.designerId}@example.test`}),
      (${fixture.customerId}, ${fixture.customerAuthId}, 'CUSTOMER', 'Phase 4 Customer', ${`phase4-customer-${fixture.customerId}@example.test`})`;
    await sql`insert into staff_memberships (account_id, role) values (${fixture.adminId}, 'ADMIN'), (${fixture.designerId}, 'DESIGNER')`;
    await sql`insert into packages (id, code, name, terms_snapshot) values (${fixture.packageId}, ${`PHASE4-${fixture.packageId}`}, 'Phase 4 Package', '{}')`;
  });
  const event = { ...demoEvents.wedding, id: randomUUID(), activities: demoEvents.wedding.activities.map((activity) => ({ ...activity, id: randomUUID() })) };
  const order = await createJobOrder(adminActor, {
    customerId: fixture.customerId, assignedDesignerId: fixture.designerId, packageId: fixture.packageId,
    currency: "PHP", quotedAmountMinor: 200000, depositRequiredMinor: 100000, dueDate: "2026-09-30",
    collectionKey: "luminous-parchment", event,
  }, { jobNumberYear: 2096 });
  orderId = order.id;
});

afterAll(async () => {
  await closeDb();
  await adminSql.begin(async (sql) => {
    await sql`delete from audit_events where actor_account_id in (${fixture.adminId}, ${fixture.designerId}, ${fixture.customerId})`;
    await sql`delete from job_orders where id = ${orderId}`;
    await sql`delete from packages where id = ${fixture.packageId}`;
    await sql`delete from staff_memberships where account_id in (${fixture.adminId}, ${fixture.designerId})`;
    await sql`delete from accounts where id in (${fixture.adminId}, ${fixture.designerId}, ${fixture.customerId})`;
    await sql`delete from job_order_counters where year = 2096`;
  });
  await adminSql.end({ timeout: 5 });
});

describe.sequential("Phase 4 production slice", () => {
  it("autosaves customer content with optimistic concurrency", async () => {
    const brief = await getEventBrief(customerActor, orderId);
    const changed = structuredClone(brief.document);
    changed.event.activities[0].venueName = "Updated ceremony venue";
    const saved = await saveEventBrief(customerActor, orderId, { expectedRevision: brief.revision, document: changed });
    expect(saved.revision).toBe(brief.revision + 1);
    expect(saved.submittedAt).toBeNull();
    await expect(saveEventBrief(customerActor, orderId, { expectedRevision: brief.revision, document: changed })).rejects.toBeInstanceOf(ContentConflictError);
    await expect(saveEventBrief(designerActor, orderId, { expectedRevision: saved.revision, document: changed })).rejects.toBeInstanceOf(ContentAuthorizationError);
  });

  it("submits normalized facts and generates a collection-pinned draft", async () => {
    const brief = await getEventBrief(customerActor, orderId);
    const submitted = await submitEventBrief(customerActor, orderId, { expectedRevision: brief.revision });
    expect(submitted.submittedAt).toBeInstanceOf(Date);
    const order = await getJobOrder(customerActor, orderId);
    expect(order.event.activities[0].venueName).toBe("Updated ceremony venue");
    const studio = await getStudioOrder(designerActor, orderId);
    expect(studio.draft.configuration.themeVersion).toBe("luminous-parchment@1.0.0");
    expect(studio.snapshot.title).toBe("Isabella");
  });

  it("autosaves only bounded designer overrides and rejects stale writes", async () => {
    const studio = await getStudioOrder(designerActor, orderId);
    const scene = studio.draft.configuration.scenes[0];
    const asset = scene.assets[0];
    const saved = await saveDraftOverrides(designerActor, orderId, {
      expectedRevision: studio.draft.revision,
      animationIntensity: "subtle",
      scenes: [{ id: scene.id, asset: { id: asset.id, x: 56, y: 44, scale: 1.1, rotation: 4, zIndex: 1, hidden: false } }],
    });
    expect(saved.draft.revision).toBe(studio.draft.revision + 1);
    expect(saved.draft.configuration.animationIntensity).toBe("subtle");
    expect(saved.draft.configuration.scenes[0].assets[0]).toMatchObject({ x: 56, y: 44, scale: 1.1, rotation: 4, zIndex: 1 });
    await expect(saveDraftOverrides(designerActor, orderId, { expectedRevision: studio.draft.revision, typography: "editorial-serif" })).rejects.toBeInstanceOf(StudioConflictError);
    await expect(getStudioOrder(customerActor, orderId)).rejects.toBeInstanceOf(StudioAuthorizationError);
  });
});
