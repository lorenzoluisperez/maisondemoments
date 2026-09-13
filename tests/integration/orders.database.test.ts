import { randomUUID } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@/db";
import { loadActorForAuthUser, syncCustomerAccount } from "@/lib/accounts/service";
import type { Actor } from "@/lib/auth/permissions";
import { demoEvents } from "@/lib/demo-data";
import { createJobOrder, getJobOrder, OrderAuthorizationError } from "@/lib/orders/service";

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;

if (!migrationUrl || !applicationUrl) {
  throw new Error("Database integration tests require MIGRATION_DATABASE_URL and DATABASE_URL");
}

const adminSql = postgres(migrationUrl, { max: 1, prepare: false });
const concurrentSql = postgres(applicationUrl, { max: 8, prepare: false });
const fixture = {
  adminId: randomUUID(),
  adminAuthId: randomUUID(),
  designerId: randomUUID(),
  designerAuthId: randomUUID(),
  customerId: randomUUID(),
  customerAuthId: randomUUID(),
  otherCustomerId: randomUUID(),
  otherCustomerAuthId: randomUUID(),
  packageId: randomUUID(),
  syncedCustomerAuthId: randomUUID(),
};

const adminActor: Actor = { accountId: fixture.adminId, accountType: "STAFF", roles: ["ADMIN"] };
const designerActor: Actor = { accountId: fixture.designerId, accountType: "STAFF", roles: ["DESIGNER"] };
const customerActor: Actor = { accountId: fixture.customerId, accountType: "CUSTOMER", roles: [] };
const otherCustomerActor: Actor = { accountId: fixture.otherCustomerId, accountType: "CUSTOMER", roles: [] };

beforeAll(async () => {
  await adminSql.begin(async (sql) => {
    await sql`
      insert into accounts (id, auth_user_id, type, display_name, email)
      values
        (${fixture.adminId}, ${fixture.adminAuthId}, 'STAFF', 'Phase 2 Admin', ${`phase2-admin-${fixture.adminId}@example.test`}),
        (${fixture.designerId}, ${fixture.designerAuthId}, 'STAFF', 'Phase 2 Designer', ${`phase2-designer-${fixture.designerId}@example.test`}),
        (${fixture.customerId}, ${fixture.customerAuthId}, 'CUSTOMER', 'Phase 2 Customer', ${`phase2-customer-${fixture.customerId}@example.test`}),
        (${fixture.otherCustomerId}, ${fixture.otherCustomerAuthId}, 'CUSTOMER', 'Other Customer', ${`phase2-other-${fixture.otherCustomerId}@example.test`})
    `;
    await sql`insert into staff_memberships (account_id, role) values (${fixture.adminId}, 'ADMIN'), (${fixture.designerId}, 'DESIGNER')`;
    await sql`
      insert into packages (id, code, name, terms_snapshot, active)
      values (${fixture.packageId}, ${`PHASE2-${fixture.packageId}`}, 'Phase 2 Test Package', ${sql.json({ revisions: 2, hostingDays: 90 })}, true)
    `;
  });
});

afterAll(async () => {
  await closeDb();
  await adminSql.begin(async (sql) => {
    await sql`delete from audit_events where actor_account_id in (${fixture.adminId}, ${fixture.designerId}, ${fixture.customerId}, ${fixture.otherCustomerId})`;
    await sql`delete from job_orders where customer_id in (${fixture.customerId}, ${fixture.otherCustomerId})`;
    await sql`delete from packages where id = ${fixture.packageId}`;
    await sql`delete from staff_memberships where account_id in (${fixture.adminId}, ${fixture.designerId})`;
    await sql`delete from accounts where auth_user_id = ${fixture.syncedCustomerAuthId}`;
    await sql`delete from accounts where id in (${fixture.adminId}, ${fixture.designerId}, ${fixture.customerId}, ${fixture.otherCustomerId})`;
    await sql`delete from job_order_counters where year in (2097, 2098)`;
  });
  await Promise.all([adminSql.end({ timeout: 5 }), concurrentSql.end({ timeout: 5 })]);
});

describe.sequential("persistent order boundary", () => {
  let orderId: string;

  it("idempotently provisions a customer account from an authenticated user", async () => {
    const first = await syncCustomerAccount({
      authUserId: fixture.syncedCustomerAuthId,
      displayName: "Initial Name",
      email: `phase2-synced-${fixture.syncedCustomerAuthId}@example.test`,
    });
    const second = await syncCustomerAccount({
      authUserId: fixture.syncedCustomerAuthId,
      displayName: "Updated Name",
      email: `phase2-synced-${fixture.syncedCustomerAuthId}@example.test`,
    });
    const actor = await loadActorForAuthUser(fixture.syncedCustomerAuthId);

    expect(second.id).toBe(first.id);
    expect(second.displayName).toBe("Updated Name");
    expect(actor).toEqual({ accountId: first.id, accountType: "CUSTOMER", roles: [] });
  });

  it("creates a validated order and reconstructs its normalized event", async () => {
    const wedding = {
      ...demoEvents.wedding,
      id: randomUUID(),
      activities: demoEvents.wedding.activities.map((activity) => ({ ...activity, id: randomUUID() })),
    };
    const order = await createJobOrder(adminActor, {
      customerId: fixture.customerId,
      assignedDesignerId: fixture.designerId,
      packageId: fixture.packageId,
      currency: "PHP",
      quotedAmountMinor: 350_000,
      depositRequiredMinor: 175_000,
      dueDate: "2026-09-01",
      event: wedding,
    }, { jobNumberYear: 2097 });

    orderId = order.id;
    expect(order.jobNumber).toMatch(/^JO-2097-\d{6}$/);
    expect(order.event.type).toBe("wedding");
    expect(order.event.activities).toHaveLength(2);
    expect(order.event.participants).toHaveLength(4);
    expect(order.event.story).toBe(wedding.story);
  });

  it("allows only the owner, assigned designer, or admin to read the order", async () => {
    await expect(getJobOrder(customerActor, orderId)).resolves.toMatchObject({ id: orderId, customerId: fixture.customerId });
    await expect(getJobOrder(designerActor, orderId)).resolves.toMatchObject({ id: orderId, assignedDesignerId: fixture.designerId });
    await expect(getJobOrder(adminActor, orderId)).resolves.toMatchObject({ id: orderId });
    await expect(getJobOrder(otherCustomerActor, orderId)).rejects.toBeInstanceOf(OrderAuthorizationError);
  });

  it("prevents customers from creating commercial orders", async () => {
    await expect(createJobOrder(customerActor, {
      customerId: fixture.customerId,
      packageId: fixture.packageId,
      currency: "PHP",
      quotedAmountMinor: 100,
      depositRequiredMinor: 50,
      event: { ...demoEvents.birthday, id: randomUUID(), activities: demoEvents.birthday.activities.map((activity) => ({ ...activity, id: randomUUID() })) },
    })).rejects.toBeInstanceOf(OrderAuthorizationError);
  });

  it("allocates unique job numbers under concurrent database calls", async () => {
    await adminSql`delete from job_order_counters where year = 2098`;
    const allocations = await Promise.all(Array.from({ length: 16 }, async () => {
      const [row] = await concurrentSql<{ job_number: string }[]>`select allocate_job_order_number(2098) as job_number`;
      return row.job_number;
    }));

    expect(new Set(allocations).size).toBe(16);
    expect(allocations.every((jobNumber) => /^JO-2098-\d{6}$/.test(jobNumber))).toBe(true);
  });

  it("denies raw browser-key access to application tables", async () => {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    const { data, error } = await supabase.from("job_orders").select("id").limit(1);

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});
