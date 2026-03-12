import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { sourceItemId } = body as { sourceItemId: string };
    if (!sourceItemId) return NextResponse.json({ error: "Missing sourceItemId" }, { status: 400 });

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: { familyProfile: true },
    });
    if (!user?.familyProfile) {
      return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    }

    // Look up the source item — must belong to a PUBLIC trip
    const source = await db.savedItem.findUnique({
      where: { id: sourceItemId },
      include: { trip: true },
    });
    if (!source || source.trip?.privacy !== "PUBLIC") {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const savedItem = await db.savedItem.create({
      data: {
        familyProfileId: user.familyProfile.id,
        sourceType: "IN_APP",
        rawTitle: source.rawTitle,
        rawDescription: source.rawDescription,
        categoryTags: source.categoryTags,
        lat: source.lat,
        lng: source.lng,
        destinationCity: source.destinationCity ?? source.trip?.destinationCity ?? null,
        destinationCountry: source.destinationCountry ?? source.trip?.destinationCountry ?? null,
        extractionStatus: "ENRICHED",
        status: "UNORGANIZED",
      },
    });

    return NextResponse.json({ savedItem });
  } catch (error) {
    console.error("Save activity error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
