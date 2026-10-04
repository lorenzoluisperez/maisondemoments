import { createHmac, randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/paymongo/route";
import { closeDb } from "@/db";

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) throw new Error("PayMongo integration tests require MIGRATION_DATABASE_URL");
const adminSql = postgres(migrationUrl, { max: 1, prepare: false });
const fixture = {
  accountId: randomUUID(), authUserId: randomUUID(), purchaseId: randomUUID(), attemptId: randomUUID(),
  sessionId: `cs_test_${randomUUID()}`, paymentId: `pay_test_${randomUUID()}`,
};
const webhookSecret = "local-paymongo-webhook-test-secret";
const originalKey = process.env.PAYMONGO_SECRET_KEY;
const originalSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
const originalAnalytics = process.env.COMMERCE_ANALYTICS_ENABLED;

function event(amount = 125000, paymentId = fixture.paymentId, live = false) {
  return JSON.stringify({ data: { type: "checkout_session.payment.paid", livemode: live, data: {
    id: fixture.sessionId, attributes: { reference_number: `MDM-${fixture.attemptId}`,
      payments: [{ id: paymentId, attributes: { status: "paid", amount, currency: "PHP" } }],
    },
  } } });
}

function request(body: string, validSignature = true) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", webhookSecret).update(`${timestamp}.${body}`).digest("hex");
  return new Request("http://localhost:5173/api/webhooks/paymongo", {
    method: "POST", body,
    headers: { "content-type": "application/json", "paymongo-signature": `t=${timestamp},te=${validSignature ? signature : "0".repeat(64)}` },
  });
}

async function state() {
  const [purchase] = await adminSql`select status from purchases where id = ${fixture.purchaseId}`;
  const [attempt] = await adminSql`select state, provider_payment_id from checkout_attempts where id = ${fixture.attemptId}`;
  return { purchase: purchase.status, attempt: attempt.state, payment: attempt.provider_payment_id };
}

beforeAll(async () => {
  process.env.PAYMONGO_SECRET_KEY = "sk_test_local_webhook";
  process.env.PAYMONGO_WEBHOOK_SECRET = webhookSecret;
  process.env.COMMERCE_ANALYTICS_ENABLED = "false";
  await adminSql.begin(async (sql) => {
    await sql`insert into accounts (id, auth_user_id, type, display_name, email)
      values (${fixture.accountId}, ${fixture.authUserId}, 'CUSTOMER', 'Webhook Test', ${`webhook-${fixture.accountId}@example.test`})`;
    await sql`insert into purchases (id, customer_id, product_slug, tier, event_date, timezone, contact_name, price_minor, terms_snapshot)
      values (${fixture.purchaseId}, ${fixture.accountId}, 'garden-romance', 'ESSENTIAL', '2028-03-18', 'Asia/Manila', 'Webhook Test', 125000, '{}')`;
    await sql`insert into checkout_attempts (id, purchase_id, provider_session_id, reference, state, amount_minor)
      values (${fixture.attemptId}, ${fixture.purchaseId}, ${fixture.sessionId}, ${`MDM-${fixture.attemptId}`}, 'OPEN', 125000)`;
  });
});

afterAll(async () => {
  await closeDb();
  await adminSql`delete from checkout_attempts where id = ${fixture.attemptId}`;
  await adminSql`delete from purchases where id = ${fixture.purchaseId}`;
  await adminSql`delete from accounts where id = ${fixture.accountId}`;
  await adminSql.end({ timeout: 5 });
  if (originalKey === undefined) delete process.env.PAYMONGO_SECRET_KEY;
  else process.env.PAYMONGO_SECRET_KEY = originalKey;
  if (originalSecret === undefined) delete process.env.PAYMONGO_WEBHOOK_SECRET;
  else process.env.PAYMONGO_WEBHOOK_SECRET = originalSecret;
  if (originalAnalytics === undefined) delete process.env.COMMERCE_ANALYTICS_ENABLED;
  else process.env.COMMERCE_ANALYTICS_ENABLED = originalAnalytics;
});

describe.sequential("PayMongo webhook settlement in the development database", () => {
  it("rejects invalid signatures and mismatched mode or amount without settling", async () => {
    expect((await POST(request(event(), false))).status).toBe(401);
    expect((await POST(request(event(125000, fixture.paymentId, true)))).status).toBe(500);
    expect((await POST(request(event(125001)))).status).toBe(500);
    expect(await state()).toEqual({ purchase: "AWAITING_PAYMENT", attempt: "OPEN", payment: null });
  });

  it("settles once and rejects a different payment identity", async () => {
    expect((await POST(request(event()))).status).toBe(200);
    expect((await POST(request(event()))).status).toBe(200);
    expect(await state()).toEqual({ purchase: "PAID", attempt: "PAID", payment: fixture.paymentId });
    expect((await POST(request(event(125000, `pay_test_${randomUUID()}`)))).status).toBe(500);
    expect(await state()).toEqual({ purchase: "PAID", attempt: "PAID", payment: fixture.paymentId });
  });
});
