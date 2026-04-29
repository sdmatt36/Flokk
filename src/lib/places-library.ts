import { db } from "@/lib/db";
import { nanoid } from "nanoid";

export async function getOrCreatePlacesLibrary(profileId: string): Promise<string> {
  const existing = await db.trip.findFirst({
    where: { familyProfileId: profileId, isPlacesLibrary: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const tripId = await db.$transaction(async (tx) => {
    const created = await tx.trip.create({
      data: {
        familyProfileId: profileId,
        title: "My Places",
        isPlacesLibrary: true,
        destinationCity: null,
        destinationCountry: null,
        shareToken: nanoid(12),
      },
    });
    await tx.tripCollaborator.create({
      data: {
        tripId: created.id,
        familyProfileId: profileId,
        role: "OWNER",
        invitedById: profileId,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
    });
    return created.id;
  });
  return tripId;
}
