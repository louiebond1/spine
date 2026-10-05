import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/session";
import { searchPalette } from "@/server/search/palette";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json(await searchPalette(q.slice(0, 100), user));
}
