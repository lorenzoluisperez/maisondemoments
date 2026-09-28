import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPaymongoSignatureBody } from "@/lib/commerce/signature";
import { isConfirmedFullRefund } from "@/lib/commerce/refund-verification";
import { productionCostSchema, productionCostVoidSchema } from "@/lib/commerce/cost-contracts";
import { demoSnapshots } from "@/lib/demo-data";
import { weddingFixtureFromSnapshot } from "@/lib/products/fixture";
import { emptyWeddingDetails } from "@/lib/products/content";
import { eventBriefDocumentSchema } from "@/lib/content/brief";
import { weddingProductBriefIssues, weddingProductReviewFitIssues } from "@/lib/products/validation";
import { productAccentStyle, productPresentationSchema } from "@/lib/products/presentation";

describe("payment authenticity", () => {
  it("accepts only a fresh raw-body signature for the configured provider mode", () => {
    const body = '{"data":{"type":"checkout_session.payment.paid"}}';
    const now = 1_800_000_000_000;
    const timestamp = String(now / 1000);
    const digest = createHmac("sha256", "test-secret").update(`${timestamp}.${body}`).digest("hex");
    expect(verifyPaymongoSignatureBody(body, `t=${timestamp},te=${digest},li=`, "test-secret", false, now)).toBe(true);
    expect(verifyPaymongoSignatureBody(body, `t=${timestamp},te=${digest},li=`, "test-secret", true, now)).toBe(false);
    expect(verifyPaymongoSignatureBody(body + " ", `t=${timestamp},te=${digest},li=`, "test-secret", false, now)).toBe(false);
    expect(verifyPaymongoSignatureBody(body, `t=${timestamp},te=${digest},li=`, "test-secret", false, now + 301_000)).toBe(false);
  });

  it("uses activity kinds even if the schedule is reordered", () => {
    const fixture = weddingFixtureFromSnapshot({
      ...demoSnapshots.wedding,
      activities: [
        { ...demoSnapshots.wedding.activities[0], kind: "reception", venueName: "Evening Hall" },
        { ...demoSnapshots.wedding.activities[1], kind: "ceremony", venueName: "Garden Chapel" },
      ],
      product: { slug: "garden-romance", designVersion: 1, dateIso: "2028-03-18T15:00:00+08:00", timezone: "Asia/Manila", weddingDetails: emptyWeddingDetails },
    });
    expect(fixture.ceremony.venue).toBe("Garden Chapel");
    expect(fixture.reception.venue).toBe("Evening Hall");
  });

  it("requires both ceremony and reception in a purchasable wedding brief", () => {
    const brief = eventBriefDocumentSchema.parse({ schemaVersion: 1, event: {
      id: crypto.randomUUID(), type: "wedding", timezone: "Asia/Manila", primaryLocalDate: "2028-03-18", rsvpDeadline: "2028-03-01",
      hostWording: "", partners: [{ displayName: "", roleLabel: "Partner" }, { displayName: "", roleLabel: "Partner" }],
      activities: [], participants: [], story: "", dressCode: "", giftInformation: "",
    }, gallery: [], weddingDetails: emptyWeddingDetails });
    expect(weddingProductBriefIssues(brief).map((issue) => issue.path)).toEqual(["event.activities.ceremony", "event.activities.reception"]);
  });

  it("requires a compact fit before releasing a long display name", () => {
    const brief = eventBriefDocumentSchema.parse({ schemaVersion: 1, event: {
      id: crypto.randomUUID(), type: "wedding", timezone: "Asia/Manila", primaryLocalDate: "2028-03-18", rsvpDeadline: "2028-03-01",
      hostWording: "", partners: [{ displayName: "Alexandria Maria Isabella Louise", roleLabel: "Partner" }, { displayName: "Sebastian Christopher Alexander", roleLabel: "Partner" }],
      activities: [], participants: [], story: "", dressCode: "", giftInformation: "",
    }, gallery: [], weddingDetails: emptyWeddingDetails });
    expect(weddingProductReviewFitIssues(brief, "standard")).toHaveLength(0);
    const longer = { ...brief, weddingDetails: { ...emptyWeddingDetails, preferredNames: ["Alexandria Maria Isabella Louise Francesca", "Sebastian"] as [string, string] } };
    expect(weddingProductReviewFitIssues(longer, "standard")[0]?.section).toBe("identity");
    expect(weddingProductReviewFitIssues(longer, "compact")).toHaveLength(0);
  });

  it("limits staff presentation to released product accents", () => {
    expect(productPresentationSchema.safeParse({ palette: "custom-css", ornaments: "original" }).success).toBe(false);
    expect(productAccentStyle("coastal-romance", { palette: "deep", ornaments: "quiet", fit: "standard" })).toHaveProperty("--deep", "#193f55");
  });
});

describe("wedding product content", () => {
  it.each(["garden-romance", "coastal-romance", "heritage-romance"] as const)("uses customer facts in %s instead of sample facts", (slug) => {
    const fixture = weddingFixtureFromSnapshot({
      ...demoSnapshots.wedding,
      title: "Alexandria",
      secondaryName: "Sebastian",
      dateLabel: "March 18, 2028",
      dressCode: "Formal",
      story: undefined,
      activities: demoSnapshots.wedding.activities.map((activity, index) => ({ ...activity, venueName: index ? "Moonlight Hall" : "The Conservatory" })),
      product: { slug, designVersion: 1, dateIso: "2028-03-18T15:00:00+08:00", timezone: "Asia/Manila", weddingDetails: { ...emptyWeddingDetails, preferredNames: ["Alexandria", "Sebastian"], monogram: "A & S" } },
    });
    expect(fixture.couple).toEqual({ first: "Alexandria", second: "Sebastian", monogram: "A & S" });
    expect(fixture.ceremony.venue).toBe("The Conservatory");
    expect(fixture.reception.venue).toBe("Moonlight Hall");
    expect(fixture.storyEnabled).toBe(false);
    expect(fixture.dressCode).toBe("Formal");
    expect(fixture.isLive).toBe(true);
  });
});

describe("provider-confirmed refunds", () => {
  it("requires a succeeded full refund for the exact payment and mode", () => {
    const expected = { refundId: "ref_12345678", paymentId: "pay_12345678", amountMinor: 125000, currency: "PHP", live: false };
    const refund = { id: expected.refundId, type: "refund", attributes: {
      status: "succeeded", payment_id: expected.paymentId, amount: expected.amountMinor, currency: "PHP", livemode: false,
    } };
    expect(isConfirmedFullRefund(refund, expected)).toBe(true);
    expect(isConfirmedFullRefund({ ...refund, attributes: { ...refund.attributes, status: "processing" } }, expected)).toBe(false);
    expect(isConfirmedFullRefund({ ...refund, attributes: { ...refund.attributes, amount: expected.amountMinor - 1 } }, expected)).toBe(false);
    expect(isConfirmedFullRefund({ ...refund, attributes: { ...refund.attributes, payment_id: "pay_other" } }, expected)).toBe(false);
    expect(isConfirmedFullRefund({ ...refund, attributes: { ...refund.attributes, livemode: true } }, expected)).toBe(false);
  });
});

describe("production cost records", () => {
  it("requires actual labor minutes and an auditable correction reason", () => {
    expect(productionCostSchema.safeParse({ category: "LABOR", minutes: 90, amountMinor: 30000, note: "Layout review" }).success).toBe(true);
    expect(productionCostSchema.safeParse({ category: "LABOR", minutes: null, amountMinor: 30000, note: "Layout review" }).success).toBe(false);
    expect(productionCostSchema.safeParse({ category: "PAYMENT_FEE", minutes: 90, amountMinor: 30000, note: "Fee" }).success).toBe(false);
    expect(productionCostSchema.safeParse({ category: "LABOR", minutes: 90, amountMinor: -1, note: "Layout review" }).success).toBe(false);
    expect(productionCostVoidSchema.safeParse({ reason: "Wrong amount" }).success).toBe(true);
    expect(productionCostVoidSchema.safeParse({ reason: "oops" }).success).toBe(false);
  });
});
