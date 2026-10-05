import { db } from "@/server/db";
import { can } from "@/server/permissions";
import { getCurrentUser } from "@/server/session";
import { readAttachment } from "@/server/storage/attachments";

/** Streams an attachment to people who can read its thread. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const attachment = await db.attachment.findUnique({ where: { id }, include: { message: { include: { question: true } } } });
  if (!attachment || !can.readThread(user, attachment.message.question)) return new Response("Not found", { status: 404 });

  const data = await readAttachment(attachment.storageKey);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
