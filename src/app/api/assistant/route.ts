import { runChat, type ChatEvent } from "@/server/assistant/chat";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Streams one Ask Spine turn as newline-delimited JSON events. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  const body = (await request.json().catch(() => ({}))) as { message?: string; threadId?: string; projectId?: string };
  if (!body.message?.trim()) return new Response("Empty message", { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: ChatEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await runChat({ viewer: user, threadId: body.threadId, projectId: body.projectId, message: body.message!, emit });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}

/** The user's latest thread for this context (a project, or the app). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const projectId = new URL(request.url).searchParams.get("projectId") || null;
  const thread = await db.assistantThread.findFirst({
    where: { userId: user.id, projectId },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 60 } },
  });
  return Response.json({
    threadId: thread?.id ?? null,
    messages: (thread?.messages ?? []).map((m) => ({ id: m.id, role: m.role, text: m.text, actions: m.actions })),
  });
}
