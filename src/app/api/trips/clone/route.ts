import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { sourceTripId, title, startDate, endDate, importActivities } = body as {
      sourceTripId: string;
      title: string;
      startDate?: string;
      endDate?: string;
      importActivities?: boolean;
    };

    if (!sourceTripId || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: { familyProfile: true },
    });
    if (!user?.familyProfile) {
      return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    }

    // Source trip must be PUBLIC
    const source = await db.trip.findUnique({
      where: { id: sourceTripId },
      include: {
        savedItems: {
          where: { dayIndex: { gt: 0 } },
          orderBy: [{ dayIndex: "asc" }, { savedAt: "asc" }],
        },
      },
    });
    if (!source || source.privacy !== "PUBLIC") {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const newTrip = await db.trip.create({
      data: {
        familyProfileId: user.familyProfile.id,
        title: title.trim(),
        destinationCity: source.destinationCity,
        destinationCountry: source.destinationCountry,
        heroImageUrl: source.heroImageUrl,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: "PLANNING",
        privacy: "PRIVATE",
      },
    });

    if (importActivities && source.savedItems.length > 0) {
      await db.savedItem.createMany({
        data: source.savedItems.map((item) => ({
          familyProfileId: user.familyProfile!.id,
          tripId: newTrip.id,
          sourceType: "IN_APP" as const,
          rawTitle: item.rawTitle,
          rawDescription: item.rawDescription,
          categoryTags: item.categoryTags,
          lat: item.lat,
          lng: item.lng,
          destinationCity: item.destinationCity ?? source.destinationCity ?? null,
          destinationCountry: item.destinationCountry ?? source.destinationCountry ?? null,
          dayIndex: item.dayIndex,
          extractionStatus: "ENRICHED" as const,
          status: "TRIP_ASSIGNED" as const,
        })),
      });
    }

    // Increment clone count on source trip
    await db.trip.update({
      where: { id: sourceTripId },
      data: { cloneCount: { increment: 1 } },
    });

    return NextResponse.json({ tripId: newTrip.id });
  } catch (error) {
    console.error("Clone trip error:", error);
    return NextResponse.json({ error: "Failed to clone trip" }, { status: 500 });
  }
}
