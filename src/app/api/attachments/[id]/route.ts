import { getCtx } from "@/server/ctx";
import { can } from "@/server/permissions";
import { readAttachment } from "@/server/storage/attachments";

/** Streams an attachment only to the asker or claimer of its thread, in the same organisation. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCtx();
  if (!ctx) return new Response("Sign in required", { status: 401 });
  const { id } = await params;
  const attachment = await ctx.db.attachment.findUnique({ where: { id }, include: { message: { include: { question: true } } } });
  const q = attachment?.message.question;
  // Same answer for "doesn't exist" and "not yours", so ids can't be probed.
  if (!attachment || !q || q.orgId !== ctx.org.id || !can.readThread(ctx.user, q)) return new Response("Not found", { status: 404 });

  const data = await readAttachment(attachment.storageKey);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
