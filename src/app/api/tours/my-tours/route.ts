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
      cityId: true,
      city: { select: { name: true, country: { select: { name: true } } } },
      transport: true,
      createdAt: true,
      _count: { select: { stops: true } },
      stops: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        take: 1,
        select: { imageUrl: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group by cityId (canonical City FK) so phantom string lanes collapse onto one City.
  // Tours still missing a cityId (unresolved regions/islands) fall back to destinationPlaceId
  // then the lowercased destinationCity string, so they stay in their own lanes — never merged.
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
    const groupKey = t.cityId ?? t.destinationPlaceId ?? t.destinationCity.toLowerCase().trim();
    const structured = t.destinationStructured as DestinationStructured | null;
    // When keyed on a real City, label from the City (clean, consistent across raw-string
    // variants in the group); otherwise fall back to the raw-string display formatter.
    const destinationDisplayName = t.cityId && t.city
      ? (t.city.country ? `${t.city.name}, ${t.city.country.name}` : t.city.name)
      : formatDestinationDisplay(structured, t.destinationCity);

    if (!grouped[groupKey]) grouped[groupKey] = [];
    const stopPhoto = t.stops[0]?.imageUrl ?? null;
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
