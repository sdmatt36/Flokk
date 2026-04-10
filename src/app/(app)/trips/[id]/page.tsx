import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { MapPin, Calendar, ChevronLeft } from "lucide-react";
import { TripTabContent } from "@/components/features/trips/TripTabContent";
import { CommunityTripView } from "@/components/features/trips/CommunityTripView";
import { getTripCoverImage } from "@/lib/destination-images";

function formatDateRange(start: Date | null, end: Date | null) {
  if (!start) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
  const startStr = start.toLocaleDateString("en-US", opts);
  if (!end) return startStr;
  const endStr = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${startStr} – ${endStr}`;
}

function tripDays(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  const diff = end.getTime() - start.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

const STATUS_LABEL: Record<string, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active now",
  COMPLETED: "Completed",
};

const STATUS_COLOR: Record<string, string> = {
  PLANNING: "#6B8F71",
  ACTIVE: "#C4664A",
  COMPLETED: "#717171",
};

export const dynamic = "force-dynamic";

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const validTabs = ["saved", "itinerary", "recommended", "packing", "notes", "vault"] as const;
  type Tab = (typeof validTabs)[number];
  const initialTab: Tab = validTabs.includes(sp.tab as Tab) ? (sp.tab as Tab) : "saved";

  const { userId } = await auth();

  const trip = await db.trip.findUnique({
    where: { id },
    include: {
      savedItems: { orderBy: [{ dayIndex: "asc" }, { savedAt: "asc" }] },
      _count: { select: { manualActivities: true, itineraryItems: true } },
    },
  });

  if (!trip) notFound();

  // Unauthenticated: send to share page if public, otherwise sign-in
  if (!userId) {
    if (trip.privacy === "PUBLIC" && trip.shareToken) {
      redirect(`/share/${trip.shareToken}`);
    }
    redirect("/sign-in");
  }

  const profileId = await resolveProfileId(userId);
  if (!profileId) redirect("/onboarding");

  const profile = await db.familyProfile.findUnique({
    where: { id: profileId },
    include: { members: true },
  });
  if (!profile) redirect("/onboarding");

  const isOwner = trip.familyProfileId === profile.id;
  const isCommunity = !isOwner && trip.privacy === "PUBLIC";

  // Block non-owners from non-public trips
  if (!isOwner && !isCommunity) notFound();

  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  const days = tripDays(trip.startDate, trip.endDate);
  const statusColor = STATUS_COLOR[trip.status] ?? "#717171";
  const heroImg = getTripCoverImage(trip.destinationCity, trip.destinationCountry, trip.heroImageUrl);

  // Serialize saved items for the community view
  const serializedItems = trip.savedItems.map((item) => ({
    id: item.id,
    rawTitle: item.rawTitle,
    rawDescription: item.rawDescription,
    placePhotoUrl: item.placePhotoUrl,
    mediaThumbnailUrl: item.mediaThumbnailUrl,
    categoryTags: item.categoryTags,
    dayIndex: item.dayIndex,
    lat: item.lat,
    lng: item.lng,
    sourceUrl: item.sourceUrl,
  }));

  const startDateIso = trip.startDate ? trip.startDate.toISOString() : null;
  const endDateIso = trip.endDate ? trip.endDate.toISOString() : null;

  const viewerMembers = (profile.members ?? []).map((m) => ({
    role: m.role as "ADULT" | "CHILD",
    name: m.name ?? '',
    birthDate: m.birthDate ? m.birthDate.toISOString() : null,
  }));

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "96px" }}>

      {/* Hero */}
      <div style={{ height: "260px", position: "relative", overflow: "hidden", backgroundColor: "#1a1a1a", backgroundImage: `url('${heroImg}')`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.75) 100%)",
          }}
        />

        {/* Back button */}
        <Link
          href={isCommunity ? "/discover" : "/trips"}
          style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            gap: "4px",
            backgroundColor: "rgba(255,255,255,0.2)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: "20px",
            padding: "6px 14px",
            color: "#fff",
            textDecoration: "none",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          <ChevronLeft size={15} />
          {isCommunity ? "Explore" : "Trips"}
        </Link>

        {/* Status pill */}
        <div
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            zIndex: 2,
            backgroundColor: "rgba(255,255,255,0.92)",
            borderRadius: "20px",
            padding: "4px 12px",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 700, color: isCommunity ? "#6B8F71" : statusColor }}>
            {isCommunity ? "Community trip" : STATUS_LABEL[trip.status]}
          </span>
        </div>

        {/* Trip title + destination */}
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            left: "24px",
            right: "24px",
            zIndex: 2,
          }}
        >
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 900,
              color: "#fff",
              lineHeight: 1.1,
              marginBottom: "6px",
              textShadow: "0 2px 12px rgba(0,0,0,0.4)",
            }}
          >
            {trip.title}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            {(trip.destinationCity || trip.destinationCountry) && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <MapPin size={13} style={{ color: "rgba(255,255,255,0.8)" }} />
                <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>
                  {[trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
            {dateRange && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Calendar size={13} style={{ color: "rgba(255,255,255,0.8)" }} />
                <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>
                  {dateRange}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", opacity: 0.85 }}>
            <MapPin size={12} style={{ color: "#fff" }} />
            {(() => {
              const count = trip.savedItems.length +
                (trip._count?.manualActivities ?? 0) +
                (trip._count?.itineraryItems ?? 0);
              const label = count === 0 ? "No saves yet" : count === 1 ? "1 place" : `${count} places`;
              return <span style={{ fontSize: "12px", color: "#fff" }}>{label}</span>;
            })()}
            <span style={{ fontSize: "12px", color: "#fff" }}>·</span>
            <Calendar size={12} style={{ color: "#fff" }} />
            <span style={{ fontSize: "12px", color: "#fff" }}>{days ?? "—"} days</span>
          </div>
        </div>
      </div>

      {isCommunity ? (
        <CommunityTripView
          items={serializedItems}
          startDate={startDateIso}
          endDate={endDateIso}
          tripId={trip.id}
          tripTitle={trip.title}
          destinationCity={trip.destinationCity ?? null}
          destinationCountry={trip.destinationCountry ?? null}
          viewerMembers={viewerMembers}
          isOwner={isOwner}
        />
      ) : (
        <TripTabContent
          initialTab={initialTab}
          tripId={trip.id}
          tripTitle={trip.title}
          tripStartDate={trip.startDate ? trip.startDate.toISOString() : null}
          tripEndDate={trip.endDate ? trip.endDate.toISOString() : null}
          destinationCity={trip.destinationCity ?? null}
          destinationCountry={trip.destinationCountry ?? null}
          initialIsAnonymous={trip.isAnonymous}
          shareToken={trip.shareToken ?? undefined}
          tripStatus={trip.status}
          initialPostTripCaptureStarted={trip.postTripCaptureStarted}
          initialPostTripCaptureComplete={trip.postTripCaptureComplete}
          initialPostTripModalVisitCount={trip.postTripModalVisitCount ?? 0}
          viewerMembers={viewerMembers}
        />
      )}

    </div>
  );
}
