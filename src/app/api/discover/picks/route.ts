import { NextRequest, NextResponse } from "next/server";
import { fetchPicks } from "@/lib/discover-data";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "200", 10), 500);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  let all = await fetchPicks();

  if (category && category !== "all") {
    all = all.filter((p) => p.category === category);
  }

  const total = all.length;
  const picks = all.slice(offset, offset + limit);

  return NextResponse.json({ picks, total });
}
