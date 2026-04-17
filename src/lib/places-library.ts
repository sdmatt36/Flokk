import { db } from "@/lib/db";
import { nanoid } from "nanoid";

export async function getOrCreatePlacesLibrary(profileId: string): Promise<string> {
  const existing = await db.trip.findFirst({
    where: { familyProfileId: profileId, isPlacesLibrary: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const trip = await db.trip.create({
    data: {
      familyProfileId: profileId,
      title: "My Places",
      isPlacesLibrary: true,
      destinationCity: null,
      destinationCountry: null,
      shareToken: nanoid(12),
    },
  });
  return trip.id;
}
