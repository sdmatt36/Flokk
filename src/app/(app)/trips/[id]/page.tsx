import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getTripAccess } from "@/lib/trip-permissions";
import { MapPin, Calendar, ChevronLeft } from "lucide-react";
import { TripTabContent } from "@/components/features/trips/TripTabContent";
import { CommunityTripView } from "@/components/features/trips/CommunityTripView";
import { DeleteTripButton } from "@/components/features/trips/DeleteTripButton";
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
      _count: { select: { manualActivities: true } },
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

  const access = await getTripAccess(profile.id, id);
  const isOwner = access?.role === 'OWNER';
  const canEdit = access?.role === 'OWNER' || access?.role === 'EDITOR';
  const canView = access !== null || trip.privacy === 'PUBLIC';
  const isCommunity = access === null && trip.privacy === 'PUBLIC';

  void canEdit; // used in future checkpoints for edit gate rendering

  if (!canView) notFound();

  // Breadcrumb geo lookup — best-effort, null = graceful fallback
  const geoCity = trip.destinationCity
    ? await db.city.findFirst({
        where: { name: { equals: trip.destinationCity, mode: "insensitive" } },
        select: {
          slug: true,
          name: true,
          country: {
            select: {
              slug: true,
              name: true,
              continent: { select: { slug: true, name: true } },
            },
          },
        },
      })
    : null;

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

        {/* Breadcrumb (community) or back pill (owner) */}
        {isCommunity && geoCity ? (
          <nav
            aria-label="Breadcrumb"
            style={{
              position: "absolute",
              top: 20,
              left: 24,
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "2px",
              fontSize: "12px",
              color: "rgba(255,255,255,0.95)",
              textShadow: "0 1px 4px rgba(0,0,0,0.7)",
              lineHeight: 1.4,
            }}
          >
            <Link href="/discover" style={{ color: "inherit", textDecoration: "none" }}>Destinations</Link>
            <span style={{ opacity: 0.6, padding: "0 3px" }}>›</span>
            <Link href={`/continents/${geoCity.country.continent.slug}`} style={{ color: "inherit", textDecoration: "none" }}>{geoCity.country.continent.name}</Link>
            <span style={{ opacity: 0.6, padding: "0 3px" }}>›</span>
            <Link href={`/countries/${geoCity.country.slug}`} style={{ color: "inherit", textDecoration: "none" }}>{geoCity.country.name}</Link>
            <span style={{ opacity: 0.6, padding: "0 3px" }}>›</span>
            <Link href={`/cities/${geoCity.slug}`} style={{ color: "inherit", textDecoration: "none" }}>{geoCity.name}</Link>
            <span style={{ opacity: 0.6, padding: "0 3px" }}>›</span>
            <span style={{ opacity: 0.75 }}>{trip.title}</span>
          </nav>
        ) : (
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
        )}

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
              const count = trip.savedItems.length + (trip._count?.manualActivities ?? 0);
              const label = count === 0 ? "No saves yet" : count === 1 ? "1 spot" : `${count} spots`;
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
        <>
          <TripTabContent
            initialTab={initialTab}
            tripId={trip.id}
            tripTitle={trip.title}
            tripStartDate={trip.startDate ? trip.startDate.toISOString() : null}
            tripEndDate={trip.endDate ? trip.endDate.toISOString() : null}
            destinationCity={trip.destinationCity ?? null}
            destinationCountry={trip.destinationCountry ?? null}
            initialIsAnonymous={trip.isAnonymous}
            initialIsPublic={trip.isPublic}
            shareToken={trip.shareToken ?? undefined}
            tripStatus={trip.status}
            initialPostTripCaptureStarted={trip.postTripCaptureStarted}
            initialPostTripCaptureComplete={trip.postTripCaptureComplete}
            initialPostTripModalVisitCount={trip.postTripModalVisitCount ?? 0}
            viewerMembers={viewerMembers}
          />
          <DeleteTripButton tripId={trip.id} tripTitle={trip.title} />
        </>
      )}

    </div>
  );
}
