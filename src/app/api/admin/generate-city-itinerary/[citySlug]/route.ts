import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { generateCityItinerary } from "@/lib/generate-city-itinerary";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ citySlug: string }> }
) {
  // Accept Clerk session auth OR CRON_SECRET for batch scripts
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { citySlug } = await params;
  try {
    const result = await generateCityItinerary(citySlug);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[generate-city-itinerary] unhandled error for ${citySlug}:`, message);
    return NextResponse.json({ status: "error", tripId: null, error: message }, { status: 500 });
  }
}
