import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getTripCoverImage } from "@/lib/destination-images";
import { formatDestinationDisplay, type DestinationStructured } from "@/lib/destination-display";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({});

  const tours = await db.generatedTour.findMany({
    where: { familyProfileId: profileId, deletedAt: null },
    select: {
      id: true,
      title: true,
      destinationCity: true,
      destinationCountry: true,
      destinationPlaceId: true,
      destinationStructured: true,
      transport: true,
      createdAt: true,
      _count: { select: { stops: true } },
      stops: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        take: 5,
        select: {
          savedItem: { select: { placePhotoUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group by destinationPlaceId (canonical dedupe key).
  // Falls back to lowercase destinationCity for tours without canonical fields.
  const grouped: Record<string, Array<{
    id: string;
    title: string;
    createdAt: string;
    stopCount: number;
    destinationCountry: string | null;
    destinationDisplayName: string;
    transport: string;
    coverImage: string | null;
  }>> = {};

  for (const t of tours) {
    const groupKey = t.destinationPlaceId ?? t.destinationCity.toLowerCase().trim();
    const structured = t.destinationStructured as DestinationStructured | null;
    const destinationDisplayName = formatDestinationDisplay(structured, t.destinationCity);

    if (!grouped[groupKey]) grouped[groupKey] = [];
    const stopPhoto = t.stops.find(s => s.savedItem?.placePhotoUrl)?.savedItem?.placePhotoUrl ?? null;
    const coverImage = stopPhoto ?? getTripCoverImage(t.destinationCity, t.destinationCountry);
    grouped[groupKey].push({
      id: t.id,
      title: t.title,
      createdAt: t.createdAt.toISOString(),
      stopCount: t._count.stops,
      destinationCountry: t.destinationCountry,
      destinationDisplayName,
      transport: t.transport,
      coverImage,
    });
  }

  // Sort groups by count desc, then alphabetical by display name.
  const sorted = Object.entries(grouped).sort(([, a], [, b]) => {
    if (b.length !== a.length) return b.length - a.length;
    return a[0].destinationDisplayName.localeCompare(b[0].destinationDisplayName);
  });

  return NextResponse.json(Object.fromEntries(sorted));
}
