import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Encrypts integration secrets (webhook URLs) at rest with AES-256-GCM. The key comes from
// SPINE_ENCRYPTION_KEY; without it, secrets can't be saved, and Spine says so in Admin.

function key(): Buffer | null {
  const raw = process.env.SPINE_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) return null;
  return createHash("sha256").update(raw).digest();
}

export const encryptionReady = () => key() !== null;

export function encrypt(plain: string): string {
  const k = key();
  if (!k) throw new Error("SPINE_ENCRYPTION_KEY is not set");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`;
}

export function decrypt(sealed: string | null | undefined): string | null {
  const k = key();
  if (!sealed || !k) return null;
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
