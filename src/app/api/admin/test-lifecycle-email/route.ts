import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sendLifecycleEmail,
  LIFECYCLE_EMAIL_TYPES,
  type LifecycleEmailType,
} from "@/lib/lifecycle-emails";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json() as {
    to?: string;
    secret?: string;
    type?: string;
    tripId?: string;
  };

  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "").trim() ??
    body.secret;
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const to = typeof body.to === "string" && body.to.trim() ? body.to.trim() : null;
  if (!to) {
    return NextResponse.json({ error: "to is required" }, { status: 400 });
  }

  const typeParam = typeof body.type === "string" ? body.type.trim() : "all";

  // Resolve a real trip for destination substitution and deep links
  let sampleTripId = typeof body.tripId === "string" && body.tripId.trim()
    ? body.tripId.trim()
    : undefined;

  if (!sampleTripId) {
    const trip = await db.trip.findFirst({
      where: { destinationCity: { not: null }, isAnonymous: false },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    sampleTripId = trip?.id;
  }

  const types: LifecycleEmailType[] =
    typeParam === "all"
      ? LIFECYCLE_EMAIL_TYPES
      : LIFECYCLE_EMAIL_TYPES.includes(typeParam as LifecycleEmailType)
        ? [typeParam as LifecycleEmailType]
        : [];

  if (types.length === 0) {
    return NextResponse.json(
      { error: `Unknown type "${typeParam}". Valid: ${LIFECYCLE_EMAIL_TYPES.join(", ")}, all` },
      { status: 400 }
    );
  }

  const results: Record<string, unknown> = {};
  for (const type of types) {
    results[type] = await sendLifecycleEmail(type, { to, tripId: sampleTripId });
  }

  const allOk = Object.values(results).every((r) => (r as { success: boolean }).success);
  return NextResponse.json({ tripId: sampleTripId ?? null, results }, { status: allOk ? 200 : 207 });
}
