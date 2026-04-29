import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Decoupled from postTripCaptureComplete per Discipline 4.11 (Trip Lifecycle). Status advances on dates only via cron.
export async function POST() {
  return NextResponse.json({
    deprecated: true,
    message: "This endpoint is deprecated. Trip lifecycle is now date-driven; see cron/trip-lifecycle.",
    updated: 0,
  });
}
