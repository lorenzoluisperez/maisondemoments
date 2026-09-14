import "server-only";

export const GUEST_COOKIE = "mdm_guest_session";
export const GUEST_SESSION_DAYS = 30;

export function getGuestSecrets() {
  const pepper = process.env.GUEST_TOKEN_PEPPER;
  const encryptionKey = process.env.GUEST_TOKEN_ENCRYPTION_KEY;
  if (!pepper || pepper.length < 32) throw new Error("GUEST_TOKEN_PEPPER must contain at least 32 characters");
  if (!encryptionKey) throw new Error("GUEST_TOKEN_ENCRYPTION_KEY is required");
  return { pepper, encryptionKey };
}
