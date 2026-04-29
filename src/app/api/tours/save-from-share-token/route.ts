import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { resolveShareToken } from "@/lib/share-token";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });

  const { token } = await req.json() as { token: string };
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const entity = await resolveShareToken(token);
  if (!entity || entity.entityType !== "generated_tour" || !entity.generatedTour) {
    return NextResponse.json({ error: "Tour not found" }, { status: 404 });
  }

  const src = entity.generatedTour;

  // Create a cloned tour owned by the requesting profile
  const newTourId = nanoid();
  await db.$transaction(async (tx) => {
    await tx.generatedTour.create({
      data: {
        id: newTourId,
        familyProfileId: profileId,
        title: src.title,
        destinationCity: src.destinationCity,
        destinationCountry: src.destinationCountry ?? null,
        prompt: src.prompt,
        durationLabel: src.durationLabel,
        transport: src.transport,
        categoryTags: src.categoryTags,
        isPublic: false,
        originalTargetStops: src.stops.length,
      },
    });

    for (const stop of src.stops) {
      await tx.tourStop.create({
        data: {
          id: nanoid(),
          tourId: newTourId,
          orderIndex: stop.orderIndex,
          name: stop.name,
          address: stop.address ?? null,
          lat: stop.lat ?? null,
          lng: stop.lng ?? null,
          durationMin: stop.durationMin ?? null,
          travelTimeMin: stop.travelTimeMin ?? null,
          why: stop.why ?? null,
          familyNote: stop.familyNote ?? null,
          imageUrl: stop.imageUrl ?? null,
          websiteUrl: stop.websiteUrl ?? null,
          ticketRequired: stop.ticketRequired ?? null,
          placeTypes: stop.placeTypes,
        },
      });
    }
  });

  return NextResponse.json({ saved: true, tourId: newTourId }, { status: 201 });
}
