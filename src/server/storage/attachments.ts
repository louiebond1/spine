import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { randomUUID } from "node:crypto";

// Attachments live on disk under UPLOAD_DIR (a Railway volume in production).

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const root = () => process.env.UPLOAD_DIR || "./uploads";

function resolveKey(key: string): string {
  const path = normalize(join(root(), key));
  if (!path.startsWith(normalize(root()))) throw new Error("Invalid storage key");
  return path;
}

export async function saveAttachment(file: File): Promise<{ storageKey: string; sizeBytes: number; fileName: string }> {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("File is too large");
  const fileName = file.name.replace(/[\\/]/g, "_").slice(0, 200) || "file";
  const storageKey = `${randomUUID()}/${fileName}`;
  const path = resolveKey(storageKey);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(await file.arrayBuffer()));
  return { storageKey, sizeBytes: file.size, fileName };
}

export async function readAttachment(storageKey: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveKey(storageKey));
  } catch {
    return null;
  }
}

/** "240 KB", "1.2 MB" */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
