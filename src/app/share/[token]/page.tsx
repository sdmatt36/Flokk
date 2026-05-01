import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getTripCoverImage } from "@/lib/destination-images";
import { mergeDuplicateLodging } from "@/lib/itinerary/merge-duplicate-lodging";
import { SharePageBottomBar } from "./SharePageBottomBar";
import { ShareItineraryView, type DayData } from "./ShareItineraryView";
import { MapPin, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const trip = await db.trip.findUnique({
    where: { shareToken: token },
    select: { title: true, destinationCity: true, destinationCountry: true },
  });
  if (!trip) return { title: "Trip — Flokk" };
  const dest = [trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ");
  return {
    title: `${trip.title}${dest ? ` · ${dest}` : ""} — shared on Flokk`,
  };
}

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
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const EXCLUDE_SAVE_TAGS = /flight|airfare|airline|lodging|accommodation|hotel|transportation/i;

const TYPE_LABEL: Record<string, string> = {
  FLIGHT: "FLT",
  TRAIN: "RAIL",
  LODGING: "STAY",
  ACTIVITY: "ACT",
};

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  FLIGHT: { bg: "#EEF4FF", color: "#3B82F6" },
  TRAIN: { bg: "#F0FFF4", color: "#6B8F71" },
  LODGING: { bg: "#FFF4EE", color: "#C4664A" },
  ACTIVITY: { bg: "#F5F5F5", color: "#888" },
};


export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ preview?: string }>;
}) {
  const { token } = await params;
  const sp = searchParams ? await searchParams : {} as { preview?: string };

  const trip = await db.trip.findUnique({
    where: { shareToken: token },
    include: {
      savedItems: { orderBy: [{ dayIndex: "asc" }, { savedAt: "asc" }] },
      itineraryItems: { orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }] },
      manualActivities: { orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }] },
      familyProfile: { select: { familyName: true } },
      placeRatings: {
        select: {
          itineraryItemId: true,
          manualActivityId: true,
          placeName: true,
          rating: true,
          notes: true,
          wouldReturn: true,
          placeType: true,
        },
      },
    },
  });

  if (!trip) notFound();

  // Increment viewCount (fire-and-forget)
  db.trip.update({ where: { id: trip.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  // Ownership check — server-side, so the bottom bar knows whether to suppress
  const previewMode = sp.preview === "true";
  const { userId } = await auth();
  let isOwner = false;
  if (userId) {
    const viewer = await db.user.findUnique({
      where: { clerkId: userId },
      select: { familyProfile: { select: { id: true } } },
    });
    isOwner = !previewMode && viewer?.familyProfile?.id === trip.familyProfileId;
  }
  const isLoggedIn = !!userId;

  const heroImg = getTripCoverImage(trip.destinationCity, trip.destinationCountry, trip.heroImageUrl);
  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  const days = tripDays(trip.startDate, trip.endDate);
  const curatorName = trip.isAnonymous || !trip.familyProfile?.familyName
    ? "A Flokk family"
    : `${trip.familyProfile.familyName} Family`;

  const destination = [trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ");
  const tripDestination = trip.destinationCity ?? destination ?? "this destination";
  const totalActivityCount =
    trip.itineraryItems.filter(i => i.type !== "FLIGHT" && i.type !== "LODGING").length +
    trip.manualActivities.length;

  // Build day label
  const tripStart = trip.startDate;
  function dayLabel(idx: number): string {
    if (tripStart) {
      const d = new Date(tripStart);
      d.setDate(d.getDate() + (idx - 1));
      return `Day ${idx} · ${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;
    }
    return `Day ${idx}`;
  }

  // ── SECTION 2: Merge itinerary items and saved activities per day ─────────
  // Itinerary items = email-imported bookings (FLIGHT, LODGING, TRAIN, ACTIVITY)
  // Saved items = manually saved places with a dayIndex assigned
  // Both are merged and sorted by clock time (untimed items last)
  type DayItem =
    | { kind: "itinerary"; data: typeof trip.itineraryItems[0]; sortKey: number }
    | { kind: "save"; data: typeof trip.savedItems[0]; sortKey: number }
    | { kind: "manual"; data: typeof trip.manualActivities[0]; sortKey: number };

  function timeToMin(t: string | null | undefined): number {
    if (!t) return 9999;
    const [h, m] = t.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return 9999;
    return h * 60 + m;
  }

  const dayItemsByDay: Record<number, DayItem[]> = {};
  const mergedItineraryItems = mergeDuplicateLodging(trip.itineraryItems);

  for (const item of mergedItineraryItems) {
    const di = item.dayIndex ?? 0;
    if (di <= 0) continue;
    // Skip LODGING check-out entries — hotel shows once on arrival day
    if (item.type === "LODGING" && /check-out/i.test(item.title)) continue;
    if (!dayItemsByDay[di]) dayItemsByDay[di] = [];
    dayItemsByDay[di].push({
      kind: "itinerary",
      data: item,
      sortKey: timeToMin(item.departureTime ?? item.arrivalTime),
    });
  }

  for (const save of trip.savedItems) {
    const di = save.dayIndex ?? 0;
    if (di <= 0) continue;
    if (!save.rawTitle) continue;
    const saveTags = save.categoryTags.join(" ");
    if (EXCLUDE_SAVE_TAGS.test(saveTags)) continue;
    if (!dayItemsByDay[di]) dayItemsByDay[di] = [];
    dayItemsByDay[di].push({
      kind: "save",
      data: save,
      sortKey: timeToMin(save.startTime),
    });
  }

  for (const ma of trip.manualActivities) {
    const di = ma.dayIndex ?? 0;
    if (di <= 0) continue;
    if (!dayItemsByDay[di]) dayItemsByDay[di] = [];
    dayItemsByDay[di].push({
      kind: "manual",
      data: ma,
      sortKey: timeToMin(ma.time),
    });
  }

  // Sort each day by clock time — timed items first, untimed last
  for (const di of Object.keys(dayItemsByDay).map(Number)) {
    dayItemsByDay[di].sort((a, b) => a.sortKey - b.sortKey);
  }

  // Discipline 4.11: every trip day renders on the share view, even days with no surviving
  // items after the check-out filter. Previously, days with only LODGING check-out entries
  // were silently dropped — recipients saw Day 1, 3, 5 but no Day 2, 4, 6+.
  const allDayIndices = days != null
    ? Array.from({ length: days }, (_, i) => i + 1)
    : Object.keys(dayItemsByDay).map(Number).sort((a, b) => a - b);

  // Ratings keyed by itineraryItemId for inline display on ACTIVITY cards
  const ratingsByItemId = new Map(
    trip.placeRatings
      .filter((r) => r.itineraryItemId)
      .map((r) => [r.itineraryItemId!, r])
  );
  // Ratings keyed by manualActivityId
  const ratingsByManualId = new Map(
    trip.placeRatings
      .filter((r) => r.manualActivityId)
      .map((r) => [r.manualActivityId!, r])
  );

  // ── Build DayData[] for ShareItineraryView (client component) ───────────
  const daysData: DayData[] = allDayIndices.map((di) => {
    const dayItems = dayItemsByDay[di] ?? [];

    const serializableItems = dayItems.map((entry) => {
      if (entry.kind === "save") {
        const s = entry.data;
        return {
          id: `save_${s.id}`,
          kind: "save" as const,
          title: s.rawTitle ?? "(no title)",
          subtitle: s.startTime ?? null,
          tag: s.categoryTags[0] ?? null,
          tagBg: "#F5F5F5",
          tagColor: "#888",
          notes: s.rawDescription ? s.rawDescription.slice(0, 200) : null,
          imageUrl: s.placePhotoUrl ?? s.mediaThumbnailUrl ?? null,
          rating: null,
          lat: s.lat ?? null,
          lng: s.lng ?? null,
          destinationCity: trip.destinationCity,
          saveable: true,
          websiteUrl: s.websiteUrl ?? null,
        };
      }
      if (entry.kind === "itinerary") {
        const it = entry.data;
        const displayTitle = it.type === "LODGING" ? it.title.replace(/^check-in:\s*/i, "") : it.title;
        const route =
          it.type === "FLIGHT" || it.type === "TRAIN"
            ? it.fromAirport && it.toAirport
              ? `${it.fromAirport} → ${it.toAirport}`
              : it.fromCity && it.toCity
              ? `${it.fromCity} → ${it.toCity}`
              : null
            : null;
        const times =
          it.departureTime && it.arrivalTime
            ? `${it.departureTime} – ${it.arrivalTime}`
            : it.departureTime || it.arrivalTime || null;
        const tc = TYPE_COLORS[it.type] ?? TYPE_COLORS.ACTIVITY;
        const ratingData = ratingsByItemId.get(it.id);
        const subtitle =
          it.type === "FLIGHT" || it.type === "TRAIN"
            ? times
            : it.type === "LODGING"
            ? it.address ?? null
            : [times, it.address].filter(Boolean).join(" · ") || null;
        return {
          id: `itin_${it.id}`,
          kind: "itinerary" as const,
          title: (it.type === "FLIGHT" || it.type === "TRAIN") && route ? route : displayTitle,
          subtitle,
          tag: TYPE_LABEL[it.type] ?? "ACT",
          tagBg: tc.bg,
          tagColor: tc.color,
          notes: (it.type === "FLIGHT" || it.type === "TRAIN") && route ? displayTitle : null,
          imageUrl: it.imageUrl ?? null, // imageUrl populated via Discipline 4.18 — see Decisions Log Chat 43
          rating: ratingData
            ? { rating: ratingData.rating, notes: ratingData.notes ?? null, wouldReturn: ratingData.wouldReturn ?? null }
            : null,
          lat: it.latitude ?? null,
          lng: it.longitude ?? null,
          destinationCity: trip.destinationCity,
          saveable: it.type === "ACTIVITY",
          websiteUrl: null,
        };
      }
      // manual
      const ma = entry.data;
      const ratingData = ratingsByManualId.get(ma.id);
      return {
        id: `manual_${ma.id}`,
        kind: "itinerary" as const,
        title: ma.title,
        subtitle: [ma.time, ma.address].filter(Boolean).join(" · ") || null,
        tag: "ACT",
        tagBg: "#F5F5F5",
        tagColor: "#888",
        notes: ma.notes ?? null,
        imageUrl: ma.imageUrl ?? null, // ManualActivity.imageUrl from schema
        rating: ratingData
          ? { rating: ratingData.rating, notes: ratingData.notes ?? null, wouldReturn: ratingData.wouldReturn ?? null }
          : null,
        lat: ma.lat ?? null,
        lng: ma.lng ?? null,
        destinationCity: trip.destinationCity,
        saveable: true,
        websiteUrl: null,
      };
    });

    const saveItems = dayItems
      .map((entry) => {
        if (entry.kind === "save") {
          const s = entry.data;
          return {
            id: `save_${s.id}`,
            title: s.rawTitle ?? "",
            lat: s.lat ?? null,
            lng: s.lng ?? null,
            imageUrl: s.placePhotoUrl ?? s.mediaThumbnailUrl ?? null,
            destinationCity: trip.destinationCity,
          };
        }
        if (entry.kind === "itinerary") {
          const it = entry.data;
          if (it.type !== "ACTIVITY") return null;
          return {
            id: it.id,
            title: it.title,
            lat: it.latitude ?? null,
            lng: it.longitude ?? null,
            imageUrl: it.imageUrl ?? null,
            destinationCity: trip.destinationCity,
          };
        }
        const ma = entry.data;
        return {
          id: ma.id,
          title: ma.title,
          lat: ma.lat ?? null,
          lng: ma.lng ?? null,
          imageUrl: ma.imageUrl ?? null,
          destinationCity: trip.destinationCity,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return {
      index: di,
      label: dayLabel(di),
      city: trip.destinationCity,
      items: serializableItems,
      saveItems,
    };
  });

  // ── SECTION 3: Nearby saved places (proximity-filtered photo grid) ────────
  const validItinCoords = trip.itineraryItems.filter(
    (it) =>
      it.latitude != null && it.longitude != null &&
      it.latitude !== 0 && it.longitude !== 0
  );

  const nearbySaves = trip.savedItems.filter((save) => {
    if (!save.lat || !save.lng || !save.rawTitle) return false;
    if ((save.dayIndex ?? 0) <= 0) return false;
    if (!(save.placePhotoUrl || save.mediaThumbnailUrl)) return false;
    const tags = save.categoryTags.join(" ");
    if (EXCLUDE_SAVE_TAGS.test(tags)) return false;
    // Must be within 3km of at least one itinerary item on the same day
    const sameDay = validItinCoords.filter((it) => it.dayIndex === save.dayIndex);
    return sameDay.some((it) => haversineKm(save.lat!, save.lng!, it.latitude!, it.longitude!) <= 3);
  });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "120px" }}>

      {/* ── Sticky header ── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff", borderBottom: "1px solid #F0F0F0" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "20px", fontWeight: 700, color: "#1B3A5C", textDecoration: "none" }}>
            Flokk
          </a>
          <a href="/discover" style={{ fontSize: "13px", color: "#888", textDecoration: "none" }}>
            ← Browse all trips
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <div
        style={{
          height: "280px",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#1a1a1a",
          backgroundImage: `url('${heroImg}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.80) 100%)" }} />
        <div style={{ position: "absolute", bottom: "24px", left: "24px", right: "24px", zIndex: 2 }}>
          <h1 style={{ fontSize: "30px", fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: "8px", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
            {trip.title}
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "6px" }}>
            {destination && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "rgba(255,255,255,0.18)", backdropFilter: "blur(4px)", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 600, color: "#fff" }}>
                <MapPin size={11} />
                {destination}
              </span>
            )}
            {dateRange && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "rgba(255,255,255,0.18)", backdropFilter: "blur(4px)", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 600, color: "#fff" }}>
                <Calendar size={11} />
                {dateRange}
              </span>
            )}
          </div>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)" }}>
            Shared by {curatorName} · {days ?? "—"} days · {totalActivityCount} activities
          </p>
        </div>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 24px" }}>

        {/* ── Day-by-day itinerary (client component handles day/category toggle) ── */}
        {daysData.length > 0 && (
          <ShareItineraryView
            days={daysData}
            isLoggedIn={isLoggedIn}
            isOwner={isOwner}
            shareToken={token}
            heroImageUrl={heroImg}
          />
        )}

        {/* ── Nearby saved places (photo grid, 3+ only) ── */}
        {nearbySaves.length >= 3 && (
          <section style={{ marginTop: "32px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", marginBottom: "4px" }}>
              Nearby spots
            </h2>
            <p style={{ fontSize: "13px", color: "#888", marginBottom: "14px" }}>
              Spots this family saved near their itinerary stops.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
              {nearbySaves.slice(0, 12).map((place) => {
                const img = place.placePhotoUrl ?? place.mediaThumbnailUrl;
                return (
                  <div
                    key={place.id}
                    style={{ borderRadius: "12px", overflow: "hidden", position: "relative", aspectRatio: "4/3", backgroundColor: "#F0F0F0" }}
                  >
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={place.rawTitle ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.65) 100%)" }} />
                    <div style={{ position: "absolute", bottom: "8px", left: "8px", right: "8px" }}>
                      <p style={{ fontSize: "12px", fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: "2px" }}>{place.rawTitle}</p>
                      {place.categoryTags.length > 0 && (
                        <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.75)" }}>{place.categoryTags[0]}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Questions for the Flokker ── */}
        <div style={{ marginTop: "48px", paddingTop: "32px", borderTop: "1px solid #e5e7eb" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "22px", color: "#1B3A5C", marginBottom: "8px" }}>
            Questions for the Flokker
          </h2>
          <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "24px" }}>
            Ask {curatorName} anything about this trip.
          </p>
          <p style={{ fontSize: "14px", color: "#9ca3af", fontStyle: "italic" }}>
            Messaging coming soon — join Flokk to be notified when it launches.
          </p>
        </div>

        {/* ── What is Flokk? (non-logged-in only) ── */}
        {!isLoggedIn && (
          <div style={{ marginTop: "32px", paddingTop: "32px", borderTop: "1px solid #F0F0F0", textAlign: "center" }}>
            <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "6px" }}>
              Flokk is free family travel planning.
            </p>
            <p style={{ fontSize: "13px", color: "#9ca3af", marginBottom: "16px" }}>
              Save places, plan days, forward booking emails. Built for families.
            </p>
            <a
              href="/sign-up"
              style={{ display: "inline-block", padding: "10px 24px", backgroundColor: "#1B3A5C", color: "#fff", fontSize: "13px", fontWeight: 700, borderRadius: "999px", textDecoration: "none" }}
            >
              Join free
            </a>
          </div>
        )}

        {/* Empty state */}
        {allDayIndices.length === 0 && nearbySaves.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "#AAAAAA" }}>
            <p style={{ fontSize: "15px" }}>This trip is being planned — check back soon.</p>
          </div>
        )}

      </div>

      {/* ── Bottom bar ── */}
      <SharePageBottomBar
        tripId={trip.id}
        isOwner={isOwner}
        shareToken={token}
        tripDestination={tripDestination}
        totalActivityCount={totalActivityCount}
      />
    </div>
  );
}
