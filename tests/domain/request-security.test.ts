import { describe, expect, it } from "vitest";
import { isTrustedMutationRequest, PayloadTooLargeError, readBoundedJson } from "@/lib/http/request-security";

describe("mutation request security", () => {
  it("requires same-origin JSON requests", () => {
    const request = new Request("https://maison.test/api/orders", {
      method: "POST",
      headers: { origin: "https://maison.test", "content-type": "application/json" },
      body: "{}",
    });
    const crossOrigin = new Request("https://maison.test/api/orders", {
      method: "POST",
      headers: { origin: "https://attacker.test", "content-type": "application/json" },
      body: "{}",
    });

    expect(isTrustedMutationRequest(request)).toBe(true);
    expect(isTrustedMutationRequest(crossOrigin)).toBe(false);
  });

  it("rejects an oversized body even without a content-length header", async () => {
    const request = new Request("https://maison.test/api/orders", {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(128 * 1024) }),
    });

    await expect(readBoundedJson(request)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });
});
