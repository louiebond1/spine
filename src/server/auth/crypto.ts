import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Password hashing (scrypt) and opaque tokens. Tokens are only ever stored as SHA-256 hashes.

const KEYLEN = 64;
const PARAMS: ScryptOptions = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCb(password, salt, KEYLEN, PARAMS, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  // Hash against a dummy when there is no account, so timing doesn't reveal which emails exist.
  const [scheme, saltB64, keyB64] = (stored ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA$").split("$");
  if (scheme !== "scrypt" || !saltB64) return false;
  const key = await scrypt(password, Buffer.from(saltB64, "base64url"));
  const expected = Buffer.from(keyB64 ?? "", "base64url");
  return !!stored && expected.length === key.length && timingSafeEqual(expected, key);
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Password rules: long enough to matter, short enough to type. */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 200) return "That password is too long.";
  if (new Set(password).size < 5) return "Use a less repetitive password.";
  return null;
}
