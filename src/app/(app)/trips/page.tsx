import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { TripsPageClient } from "@/components/features/trips/TripsPageClient";

export const dynamic = "force-dynamic";

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { tab } = await searchParams;

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: {
      familyProfile: {
        include: {
          trips: {
            orderBy: { startDate: "asc" },
            include: {
              _count: { select: { savedItems: true, packingItems: true } },
              savedItems: { select: { dayIndex: true }, where: { dayIndex: { not: null } } },
              manualActivities: { select: { dayIndex: true, status: true }, where: { dayIndex: { not: null } } },
              itineraryItems: { select: { type: true } },
            },
          },
        },
      },
    },
  });

  if (!user?.familyProfile) redirect("/onboarding");

  const trips = user.familyProfile.trips.map((t) => {
    // Build per-day item counts
    const dayItemCounts: Record<number, number> = {};
    for (const item of t.savedItems) {
      if (item.dayIndex != null) {
        dayItemCounts[item.dayIndex] = (dayItemCounts[item.dayIndex] ?? 0) + 1;
      }
    }
    for (const act of t.manualActivities) {
      if (act.dayIndex != null && (act.status === "confirmed" || act.status === "booked")) {
        dayItemCounts[act.dayIndex] = (dayItemCounts[act.dayIndex] ?? 0) + 1;
      }
    }
    const wellPlannedDays = Object.values(dayItemCounts).filter((c) => c >= 2).length;
    const startedDays = Object.values(dayItemCounts).filter((c) => c === 1).length;

    return {
      id: t.id,
      title: t.title,
      destinationCity: t.destinationCity,
      destinationCountry: t.destinationCountry,
      startDate: t.startDate ? t.startDate.toISOString() : null,
      endDate: t.endDate ? t.endDate.toISOString() : null,
      status: t.status as "PLANNING" | "ACTIVE" | "COMPLETED",
      heroImageUrl: t.heroImageUrl,
      savedCount: t._count.savedItems,
      dayItemCounts,
      wellPlannedDays,
      startedDays,
      hasFlights: t.itineraryItems.some(i => i.type === "FLIGHT"),
      hasLodging: t.itineraryItems.some(i => i.type === "LODGING"),
      itineraryActivityCount: t.itineraryItems.filter(i => i.type === "ACTIVITY").length,
      packingCount: t._count.packingItems,
      shareToken: t.shareToken,
      isAnonymous: t.isAnonymous,
      familyName: user.familyProfile!.familyName,
    };
  });

  return <TripsPageClient trips={trips} defaultTab={tab === "past" ? "past" : "upcoming"} />;
}
