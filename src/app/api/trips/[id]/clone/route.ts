import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });
  if (!user?.familyProfile) {
    return NextResponse.json({ error: "No family profile" }, { status: 400 });
  }

  // Fetch the source trip (must be PUBLIC or owned by requester)
  const source = await db.trip.findUnique({
    where: { id },
    include: {
      savedItems: true,
      itineraryItems: true,
    },
  });

  if (!source) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const isOwner = source.familyProfileId === user.familyProfile.id;
  if (!isOwner && source.privacy !== "PUBLIC") {
    return NextResponse.json({ error: "Trip not accessible" }, { status: 403 });
  }

  // Create the cloned trip
  const newTrip = await db.trip.create({
    data: {
      familyProfileId: user.familyProfile.id,
      title: source.title,
      destinationCity: source.destinationCity,
      destinationCountry: source.destinationCountry,
      startDate: source.startDate,
      endDate: source.endDate,
      status: "PLANNING",
      privacy: "PRIVATE",
      heroImageUrl: source.heroImageUrl,
      tripType: source.tripType,
      isAnonymous: true,
      shareToken: nanoid(12),
    },
  });

  // Clone saved items (omit cost/booking details)
  if (source.savedItems.length > 0) {
    await db.savedItem.createMany({
      data: source.savedItems.map((item) => ({
        familyProfileId: user.familyProfile!.id,
        tripId: newTrip.id,
        sourceType: item.sourceType,
        sourceUrl: item.sourceUrl,
        rawTitle: item.rawTitle,
        rawDescription: item.rawDescription,
        mediaThumbnailUrl: item.mediaThumbnailUrl,
        placePhotoUrl: item.placePhotoUrl,
        destinationCity: item.destinationCity,
        destinationCountry: item.destinationCountry,
        lat: item.lat,
        lng: item.lng,
        categoryTags: item.categoryTags,
        interestKeys: item.interestKeys,
        status: "UNORGANIZED" as const,
        extractionStatus: "ENRICHED" as const,
        dayIndex: item.dayIndex,
        notes: item.notes,
        websiteUrl: item.websiteUrl,
        affiliateUrl: item.affiliateUrl,
      })),
    });
  }

  // Clone itinerary items (omit confirmationCode, totalCost, currency, passengers)
  if (source.itineraryItems.length > 0) {
    await db.itineraryItem.createMany({
      data: source.itineraryItems.map((item) => ({
        tripId: newTrip.id,
        type: item.type,
        title: item.title,
        scheduledDate: item.scheduledDate,
        departureTime: item.departureTime,
        arrivalTime: item.arrivalTime,
        fromAirport: item.fromAirport,
        toAirport: item.toAirport,
        fromCity: item.fromCity,
        toCity: item.toCity,
        notes: item.notes,
        address: item.address,
        dayIndex: item.dayIndex,
        latitude: item.latitude,
        longitude: item.longitude,
        sortOrder: item.sortOrder,
        sourceType: "CLONED",
      })),
    });
  }

  // Increment source cloneCount
  await db.trip.update({
    where: { id: source.id },
    data: { cloneCount: { increment: 1 } },
  });

  return NextResponse.json({ tripId: newTrip.id });
}
