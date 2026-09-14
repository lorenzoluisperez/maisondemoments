import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@/db";
import type { Actor } from "@/lib/auth/permissions";
import { demoEvents } from "@/lib/demo-data";
import { createJobOrder } from "@/lib/orders/service";
import { listPayments, PaymentAuthorizationError, PaymentConflictError, recordPayment, reversePayment } from "@/lib/payments/service";

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) throw new Error("Operations integration tests require MIGRATION_DATABASE_URL");
const adminSql = postgres(migrationUrl, { max: 1, prepare: false });
const fixture = { adminId: randomUUID(), adminAuthId: randomUUID(), customerId: randomUUID(), customerAuthId: randomUUID(), packageId: randomUUID() };
const admin: Actor = { accountId: fixture.adminId, accountType: "STAFF", roles: ["ADMIN"] };
const customer: Actor = { accountId: fixture.customerId, accountType: "CUSTOMER", roles: [] };
let orderId: string;

beforeAll(async () => {
  await adminSql`insert into accounts (id, auth_user_id, type, display_name, email) values (${fixture.adminId}, ${fixture.adminAuthId}, 'STAFF', 'Operations Admin', ${`ops-admin-${fixture.adminId}@example.test`}), (${fixture.customerId}, ${fixture.customerAuthId}, 'CUSTOMER', 'Operations Customer', ${`ops-customer-${fixture.customerId}@example.test`})`;
  await adminSql`insert into staff_memberships (account_id, role) values (${fixture.adminId}, 'ADMIN')`;
  await adminSql`insert into packages (id, code, name, terms_snapshot) values (${fixture.packageId}, ${`OPS-${fixture.packageId}`}, 'Operations Package', '{}')`;
  const event = { ...demoEvents.birthday, id: randomUUID(), activities: demoEvents.birthday.activities.map((activity) => ({ ...activity, id: randomUUID() })) };
  orderId = (await createJobOrder(admin, { customerId: fixture.customerId, packageId: fixture.packageId, currency: "PHP", quotedAmountMinor: 100000, depositRequiredMinor: 50000, collectionKey: "midnight-garden", event }, { jobNumberYear: 2091 })).id;
});

afterAll(async () => {
  await closeDb();
  await adminSql`delete from audit_events where actor_account_id = ${fixture.adminId}`;
  await adminSql`delete from payment_entries where job_order_id = ${orderId}`;
  await adminSql`delete from job_orders where id = ${orderId}`;
  await adminSql`delete from packages where id = ${fixture.packageId}`;
  await adminSql`delete from staff_memberships where account_id = ${fixture.adminId}`;
  await adminSql`delete from accounts where id in (${fixture.adminId}, ${fixture.customerId})`;
  await adminSql`delete from job_order_counters where year = 2091`;
  await adminSql.end({ timeout: 5 });
});

describe.sequential("Phase 7 operational ledger", () => {
  it("limits payment operations to admins and makes recording idempotent", async () => {
    await expect(listPayments(customer, orderId)).rejects.toBeInstanceOf(PaymentAuthorizationError);
    const key = randomUUID();
    await recordPayment(admin, orderId, { amountMinor: 50000, method: "Bank transfer", externalReference: `TX-${fixture.adminId}`, idempotencyKey: key });
    const repeated = await recordPayment(admin, orderId, { amountMinor: 50000, method: "Bank transfer", externalReference: `TX-${fixture.adminId}`, idempotencyKey: key });
    expect(repeated).toMatchObject({ paidAmountMinor: 50000, outstandingAmountMinor: 50000 });
    expect(repeated.entries).toHaveLength(1);
  });

  it("records one exact audited reversal", async () => {
    const ledger = await listPayments(admin, orderId);
    const original = ledger.entries.find((entry) => entry.amountMinor > 0)!;
    const reversed = await reversePayment(admin, orderId, original.id, { reason: "Duplicate customer transfer", idempotencyKey: randomUUID() });
    expect(reversed.paidAmountMinor).toBe(0);
    await expect(reversePayment(admin, orderId, original.id, { reason: "Second reversal", idempotencyKey: randomUUID() })).rejects.toBeInstanceOf(PaymentConflictError);
  });
});
