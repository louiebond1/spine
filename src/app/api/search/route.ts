import { NextResponse } from "next/server";
import { getCtx } from "@/server/ctx";
import { searchPalette } from "@/server/search/palette";

export async function GET(request: Request) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json(await searchPalette(ctx, q.slice(0, 100)), { headers: { "Cache-Control": "private, no-store" } });
}
