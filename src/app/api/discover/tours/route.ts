import { NextRequest, NextResponse } from "next/server";
import { fetchTours } from "@/lib/discover-data";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "200", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const all = await fetchTours();
  const total = all.length;
  const tours = all.slice(offset, offset + limit);

  return NextResponse.json({ tours, total });
}
