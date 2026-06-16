import { NextRequest, NextResponse } from "next/server";
import { fetchPicks } from "@/lib/discover-data";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "200", 10), 500);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const all = await fetchPicks();

  // Compute category facets from full normalized pool before any category filter
  const countMap = new Map<string, number>();
  for (const p of all) {
    if (p.category) countMap.set(p.category, (countMap.get(p.category) ?? 0) + 1);
  }
  const categories = [...countMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => ({ category: cat, count }));

  const filtered =
    category && category !== "all" ? all.filter((p) => p.category === category) : all;

  const total = filtered.length;
  const picks = filtered.slice(offset, offset + limit);

  return NextResponse.json({ picks, total, categories });
}
