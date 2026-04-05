import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getTripCoverImage } from "@/lib/destination-images";
import { SharePageBottomBar } from "./SharePageBottomBar";

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

function starString(rating: number): string {
  return "★".repeat(Math.max(0, Math.min(5, rating))) + "☆".repeat(Math.max(0, 5 - rating));
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const trip = await db.trip.findUnique({
    where: { shareToken: token },
    include: {
      savedItems: { orderBy: [{ dayIndex: "asc" }, { savedAt: "asc" }] },
      itineraryItems: { orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }] },
      familyProfile: { select: { familyName: true, homeCity: true } },
      placeRatings: {
        select: {
          itineraryItemId: true,
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
  const { userId } = await auth();
  let isOwner = false;
  if (userId) {
    const viewer = await db.user.findUnique({
      where: { clerkId: userId },
      select: { familyProfile: { select: { id: true } } },
    });
    isOwner = viewer?.familyProfile?.id === trip.familyProfileId;
  }

  const heroImg = getTripCoverImage(trip.destinationCity, trip.destinationCountry, trip.heroImageUrl);
  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  const days = tripDays(trip.startDate, trip.endDate);
  const curatorName = trip.isAnonymous
    ? "A Flokk family"
    : trip.familyProfile?.familyName
    ? trip.familyProfile.homeCity
      ? `${trip.familyProfile.familyName} Family, ${trip.familyProfile.homeCity}`
      : `${trip.familyProfile.familyName} Family`
    : "A Flokk family";

  const destination = [trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ");

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

  // ── SECTION 2: Group itinerary items by day ───────────────────────────────
  // Deduplicate LODGING: keep only check-in entries, strip prefix for display
  const itineraryByDay: Record<number, typeof trip.itineraryItems> = {};
  for (const item of trip.itineraryItems) {
    const di = item.dayIndex ?? 0;
    if (di <= 0) continue;
    // Skip check-out entries — hotel shows once on arrival day
    if (item.type === "LODGING" && /check-out/i.test(item.title)) continue;
    if (!itineraryByDay[di]) itineraryByDay[di] = [];
    itineraryByDay[di].push(item);
  }
  const allDayIndices = Object.keys(itineraryByDay).map(Number).sort((a, b) => a - b);

  // Ratings keyed by itineraryItemId for inline display on ACTIVITY cards
  const ratingsByItemId = new Map(
    trip.placeRatings
      .filter((r) => r.itineraryItemId)
      .map((r) => [r.itineraryItemId!, r])
  );

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

  // ── SECTION 4: Ratings list ───────────────────────────────────────────────
  const ratingsForDisplay = trip.placeRatings;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "120px" }}>

      {/* ── SECTION 1 — Hero header ── */}
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
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.80) 100%)",
          }}
        />

        {/* Flokk badge */}
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            zIndex: 2,
            backgroundColor: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: "20px",
            padding: "5px 14px",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          flokk
        </div>

        {/* Trip info */}
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
              fontSize: "30px",
              fontWeight: 900,
              color: "#fff",
              lineHeight: 1.1,
              marginBottom: "8px",
              textShadow: "0 2px 12px rgba(0,0,0,0.4)",
            }}
          >
            {trip.title}
          </h1>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.9)", fontWeight: 500, marginBottom: "4px" }}>
            {[destination, dateRange].filter(Boolean).join(" · ")}
          </p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)" }}>
            Shared by {curatorName} · {days ?? "—"} days
          </p>
        </div>
      </div>

      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "0 16px" }}>

        {/* ── SECTION 2 — Day-by-day itinerary ── */}
        {allDayIndices.length > 0 && (
          <section style={{ marginTop: "28px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", marginBottom: "16px" }}>
              Itinerary
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {allDayIndices.map((di) => {
                const items = itineraryByDay[di] ?? [];
                return (
                  <div key={di}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
                      {dayLabel(di)}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {items.map((item) => {
                        const tc = TYPE_COLORS[item.type] ?? TYPE_COLORS.ACTIVITY;
                        const rating = ratingsByItemId.get(item.id);

                        // Cleaned title: strip "Check-in: " prefix for LODGING
                        const displayTitle = item.type === "LODGING"
                          ? item.title.replace(/^check-in:\s*/i, "")
                          : item.title;

                        // Route string for FLIGHT and TRAIN
                        const route =
                          item.type === "FLIGHT" || item.type === "TRAIN"
                            ? item.fromAirport && item.toAirport
                              ? `${item.fromAirport} → ${item.toAirport}`
                              : item.fromCity && item.toCity
                              ? `${item.fromCity} → ${item.toCity}`
                              : null
                            : null;

                        // Times string
                        const times =
                          item.departureTime && item.arrivalTime
                            ? `${item.departureTime} – ${item.arrivalTime}`
                            : item.departureTime || item.arrivalTime || null;

                        return (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "10px",
                              backgroundColor: "#F9F9F9",
                              borderRadius: "10px",
                              padding: "10px 12px",
                            }}
                          >
                            {/* Type badge */}
                            <div
                              style={{
                                flexShrink: 0,
                                marginTop: "3px",
                                backgroundColor: tc.bg,
                                borderRadius: "4px",
                                padding: "2px 5px",
                              }}
                            >
                              <span style={{ fontSize: "9px", fontWeight: 800, color: tc.color, letterSpacing: "0.05em" }}>
                                {TYPE_LABEL[item.type] ?? "ACT"}
                              </span>
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Primary display */}
                              {item.type === "FLIGHT" || item.type === "TRAIN" ? (
                                <>
                                  {route && (
                                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px" }}>
                                      {route}
                                    </p>
                                  )}
                                  <p style={{ fontSize: "13px", fontWeight: 500, color: route ? "#555" : "#1a1a1a", marginBottom: "2px" }}>
                                    {displayTitle}
                                  </p>
                                  {times && (
                                    <p style={{ fontSize: "12px", color: "#888" }}>{times}</p>
                                  )}
                                </>
                              ) : item.type === "LODGING" ? (
                                <>
                                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px" }}>
                                    {displayTitle}
                                  </p>
                                  {item.address && (
                                    <p style={{ fontSize: "12px", color: "#888" }}>{item.address}</p>
                                  )}
                                </>
                              ) : (
                                /* ACTIVITY and OTHER */
                                <>
                                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px" }}>
                                    {displayTitle}
                                  </p>
                                  {times && (
                                    <p style={{ fontSize: "12px", color: "#888" }}>{times}</p>
                                  )}
                                  {item.address && (
                                    <p style={{ fontSize: "12px", color: "#AAAAAA", marginTop: "2px" }}>{item.address}</p>
                                  )}
                                  {/* Inline rating from How was it? */}
                                  {rating && (
                                    <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px solid #EEEEEE" }}>
                                      <p style={{ fontSize: "13px", color: "#C4664A", letterSpacing: "0.05em" }}>
                                        {starString(rating.rating)}
                                      </p>
                                      {rating.notes && (
                                        <p style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>{rating.notes}</p>
                                      )}
                                      {rating.wouldReturn && (
                                        <p style={{ fontSize: "11px", color: "#6B8F71", fontWeight: 600, marginTop: "2px" }}>
                                          Would visit again
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── SECTION 3 — Nearby saved places (photo grid, 3+ only) ── */}
        {nearbySaves.length >= 3 && (
          <section style={{ marginTop: "32px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", marginBottom: "4px" }}>
              Nearby places
            </h2>
            <p style={{ fontSize: "13px", color: "#888", marginBottom: "14px" }}>
              Places this family saved near their itinerary stops.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "10px",
              }}
            >
              {nearbySaves.slice(0, 12).map((place) => {
                const img = place.placePhotoUrl ?? place.mediaThumbnailUrl;
                return (
                  <div
                    key={place.id}
                    style={{
                      borderRadius: "12px",
                      overflow: "hidden",
                      position: "relative",
                      aspectRatio: "4/3",
                      backgroundColor: "#F0F0F0",
                    }}
                  >
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={place.rawTitle ?? ""}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    )}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.65) 100%)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: "8px",
                        left: "8px",
                        right: "8px",
                      }}
                    >
                      <p style={{ fontSize: "12px", fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: "2px" }}>
                        {place.rawTitle}
                      </p>
                      {place.categoryTags.length > 0 && (
                        <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.75)" }}>
                          {place.categoryTags[0]}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── SECTION 4 — Ratings and tips (only if How was it? was completed) ── */}
        {ratingsForDisplay.length > 0 && (
          <section style={{ marginTop: "32px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", marginBottom: "4px" }}>
              What the family thought
            </h2>
            <p style={{ fontSize: "13px", color: "#888", marginBottom: "14px" }}>
              Honest reviews from the people who were there.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {ratingsForDisplay.map((r) => (
                <div
                  key={`${r.itineraryItemId ?? r.placeName}`}
                  style={{
                    backgroundColor: "#F9F9F9",
                    borderRadius: "10px",
                    padding: "12px 14px",
                  }}
                >
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "4px" }}>
                    {r.placeName}
                  </p>
                  <p style={{ fontSize: "14px", color: "#C4664A", letterSpacing: "0.05em", marginBottom: r.notes || r.wouldReturn ? "6px" : "0" }}>
                    {starString(r.rating)}
                  </p>
                  {r.notes && (
                    <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.5 }}>{r.notes}</p>
                  )}
                  {r.wouldReturn && (
                    <p style={{ fontSize: "11px", color: "#6B8F71", fontWeight: 600, marginTop: "4px" }}>
                      Would visit again
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state — no itinerary and no nearby saves */}
        {allDayIndices.length === 0 && nearbySaves.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "#AAAAAA" }}>
            <p style={{ fontSize: "15px" }}>This trip is being planned — check back soon.</p>
          </div>
        )}

      </div>

      {/* ── SECTION 5 — Bottom bar (auth-aware CTA) ── */}
      <SharePageBottomBar tripId={trip.id} isOwner={isOwner} />
    </div>
  );
}
