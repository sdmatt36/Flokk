import { NextRequest, NextResponse } from "next/server";
import { fetchTrips } from "@/lib/discover-data";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "200", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const all = await fetchTrips();
  const total = all.length;
  const itineraries = all.slice(offset, offset + limit);

  return NextResponse.json({ itineraries, total });
}
