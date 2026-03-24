import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";

// POST /api/admin/trigger-enrich
// Triggers the one-time backfill to enrich seeded SavedItems (lat=null, trip.privacy=PUBLIC).
export async function POST() {
  await inngest.send({ name: "saves/enrich-seeded", data: {} });
  return NextResponse.json({ triggered: true });
}
