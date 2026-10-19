import { rootDb } from "@/server/db";

export const dynamic = "force-dynamic";

/** Liveness and database check for Railway. Reveals nothing about any organisation. */
export async function GET() {
  try {
    await rootDb.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
