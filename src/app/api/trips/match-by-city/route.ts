import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ matches: [] });

  const url = new URL(req.url);
  const city = url.searchParams.get("city")?.trim();
  if (!city) return NextResponse.json({ matches: [] });

  const now = new Date();

  // Match A: trips where destinationCity equals city (case-insensitive)
  const primary = await db.trip.findMany({
    where: {
      familyProfileId: profileId,
      destinationCity: { equals: city, mode: "insensitive" },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    select: { id: true, title: true, destinationCity: true, startDate: true, endDate: true },
    orderBy: { startDate: "asc" },
  });

  // Match B: trips where at least one ItineraryItem has a matching city.
  // ItineraryItem.city does not exist yet — this branch no-ops gracefully.
  let secondary: typeof primary = [];
  try {
    secondary = await db.trip.findMany({
      where: {
        familyProfileId: profileId,
        id: { notIn: primary.map((t) => t.id) },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
        // @ts-expect-error city field does not exist on ItineraryItem yet (Prompt 6)
        itineraryItems: { some: { city: { equals: city, mode: "insensitive" } } },
      },
      select: { id: true, title: true, destinationCity: true, startDate: true, endDate: true },
      orderBy: { startDate: "asc" },
    });
  } catch {
    secondary = [];
  }

  const matches = [
    ...primary.map((t) => ({
      id: t.id,
      name: t.title,
      destinationCity: t.destinationCity,
      startDate: t.startDate?.toISOString() ?? null,
      endDate: t.endDate?.toISOString() ?? null,
      matchReason: "primary-city" as const,
    })),
    ...secondary.map((t) => ({
      id: t.id,
      name: t.title,
      destinationCity: t.destinationCity,
      startDate: t.startDate?.toISOString() ?? null,
      endDate: t.endDate?.toISOString() ?? null,
      matchReason: "itinerary-item-city" as const,
    })),
  ];

  return NextResponse.json({ matches });
}
