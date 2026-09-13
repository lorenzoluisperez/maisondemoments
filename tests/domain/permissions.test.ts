import { describe, expect, it } from "vitest";
import { canPublish, canReadGuestExport, canReadOrder } from "@/lib/auth/permissions";

const order = { customerId: "customer", assignedDesignerId: "designer" };

describe("role boundaries", () => {
  it("limits designers to assigned production work", () => {
    expect(canReadOrder({ accountId: "designer", accountType: "STAFF", roles: ["DESIGNER"] }, order)).toBe(true);
    expect(canReadOrder({ accountId: "another", accountType: "STAFF", roles: ["DESIGNER"] }, order)).toBe(false);
  });

  it("reserves publication for admins", () => {
    expect(canPublish({ accountId: "designer", accountType: "STAFF", roles: ["DESIGNER"] })).toBe(false);
    expect(canPublish({ accountId: "admin", accountType: "STAFF", roles: ["ADMIN"] })).toBe(true);
  });

  it("keeps guest exports from designers", () => {
    expect(canReadGuestExport({ accountId: "designer", accountType: "STAFF", roles: ["DESIGNER"] }, order)).toBe(false);
  });
});
