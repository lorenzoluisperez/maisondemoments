import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;
const IV_BYTES = 12;

export type GuestCredential = {
  token: string;
  digest: string;
  encryptedToken: string;
};

export function issueGuestCredential(secrets: { pepper: string; encryptionKey: string }): GuestCredential {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return {
    token,
    digest: digestGuestToken(token, secrets.pepper),
    encryptedToken: encryptGuestToken(token, secrets.encryptionKey),
  };
}

export function digestGuestToken(token: string, pepper: string) {
  requireSecret(pepper, "GUEST_TOKEN_PEPPER", 32);
  return createHmac("sha256", pepper).update(token).digest("base64url");
}

export function matchesGuestToken(token: string, expectedDigest: string, pepper: string) {
  const actual = Buffer.from(digestGuestToken(token, pepper), "base64url");
  const expected = Buffer.from(expectedDigest, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function encryptGuestToken(token: string, encodedKey: string) {
  const key = decodeEncryptionKey(encodedKey);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((value) => value.toString("base64url")).join(".");
}

export function decryptGuestToken(encrypted: string, encodedKey: string) {
  const key = decodeEncryptionKey(encodedKey);
  const parts = encrypted.split(".");
  if (parts.length !== 3) throw new Error("Malformed encrypted guest token");
  const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, "base64url"));
  if (iv.length !== IV_BYTES || tag.length !== 16) throw new Error("Malformed encrypted guest token");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function decodeEncryptionKey(encodedKey: string) {
  const key = Buffer.from(encodedKey, "base64url");
  if (key.length !== 32) throw new Error("GUEST_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return key;
}

function requireSecret(value: string, name: string, minimumLength: number) {
  if (value.length < minimumLength) throw new Error(`${name} must contain at least ${minimumLength} characters`);
}
