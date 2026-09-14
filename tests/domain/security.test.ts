import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptGuestToken, digestGuestSession, issueGuestCredential, issueGuestSession, matchesGuestToken } from "@/lib/security/guest-credentials";

describe("guest credentials", () => {
  const secrets = { pepper: "p".repeat(32), encryptionKey: randomBytes(32).toString("base64url") };

  it("issues 256-bit bearer credentials without storing plaintext", () => {
    const credential = issueGuestCredential(secrets);
    expect(Buffer.from(credential.token, "base64url")).toHaveLength(32);
    expect(credential.digest).not.toContain(credential.token);
    expect(matchesGuestToken(credential.token, credential.digest, secrets.pepper)).toBe(true);
    expect(decryptGuestToken(credential.encryptedToken, secrets.encryptionKey)).toBe(credential.token);
  });

  it("rejects the wrong token and tampered ciphertext", () => {
    const credential = issueGuestCredential(secrets);
    expect(matchesGuestToken("wrong-token", credential.digest, secrets.pepper)).toBe(false);
    expect(() => decryptGuestToken(`${credential.encryptedToken}x`, secrets.encryptionKey)).toThrow();
  });

  it("separates guest-session digests from invitation-link digests", () => {
    const session = issueGuestSession(secrets.pepper);
    expect(Buffer.from(session.token, "base64url")).toHaveLength(32);
    expect(session.digest).toBe(digestGuestSession(session.token, secrets.pepper));
    expect(session.digest).not.toBe(issueGuestCredential(secrets).digest);
  });
});
