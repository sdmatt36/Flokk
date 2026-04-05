import { notFound } from "next/navigation";
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
    },
  });

  if (!trip) notFound();

  // Increment viewCount (fire-and-forget)
  db.trip.update({ where: { id: trip.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const heroImg = getTripCoverImage(trip.destinationCity, trip.destinationCountry, trip.heroImageUrl);
  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  const days = tripDays(trip.startDate, trip.endDate);
  const curatorName = trip.isAnonymous
    ? "Flokk Family — Anonymous"
    : trip.familyProfile?.familyName
    ? trip.familyProfile.homeCity
      ? `${trip.familyProfile.familyName} Family, ${trip.familyProfile.homeCity}`
      : `${trip.familyProfile.familyName} Family`
    : "Flokk Family — Anonymous";

  // Build day label from tripStart
  const tripStart = trip.startDate;
  function dayLabel(idx: number): string {
    if (tripStart) {
      const d = new Date(tripStart);
      d.setDate(d.getDate() + (idx - 1));
      return `Day ${idx} · ${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;
    }
    return `Day ${idx}`;
  }

  // Group itinerary items by dayIndex (skip day 0 — unscheduled)
  const itineraryByDay: Record<number, typeof trip.itineraryItems> = {};
  for (const item of trip.itineraryItems) {
    if ((item.dayIndex ?? 0) > 0) {
      const di = item.dayIndex!;
      if (!itineraryByDay[di]) itineraryByDay[di] = [];
      itineraryByDay[di].push(item);
    }
  }

  // Group saved places by dayIndex (skip day 0 — unscheduled)
  const savedByDay: Record<number, typeof trip.savedItems> = {};
  for (const item of trip.savedItems) {
    if ((item.dayIndex ?? 0) > 0) {
      const di = item.dayIndex!;
      if (!savedByDay[di]) savedByDay[di] = [];
      savedByDay[di].push(item);
    }
  }

  // All days with any content
  const allDayIndices = [
    ...new Set([
      ...Object.keys(itineraryByDay).map(Number),
      ...Object.keys(savedByDay).map(Number),
    ]),
  ].sort((a, b) => a - b);

  // Unscheduled saved places with photos (dayIndex null/0)
  const unsortedPhotos = trip.savedItems.filter(
    (s) => (s.dayIndex ?? 0) === 0 && (s.placePhotoUrl || s.mediaThumbnailUrl)
  );

  const destination = [trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ");

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "120px" }}>

      {/* Hero */}
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

        {/* Day-by-day itinerary */}
        {allDayIndices.length > 0 && (
          <section style={{ marginTop: "28px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", marginBottom: "16px" }}>
              Itinerary
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {allDayIndices.map((di) => {
                const itinItems = itineraryByDay[di] ?? [];
                const savedItems = savedByDay[di] ?? [];
                return (
                  <div key={di}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
                      {dayLabel(di)}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>

                      {/* Booked/imported itinerary items (FLIGHT, LODGING, TRAIN, ACTIVITY) */}
                      {itinItems.map((item) => {
                        const tc = TYPE_COLORS[item.type] ?? TYPE_COLORS.ACTIVITY;
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
                            <div
                              style={{
                                flexShrink: 0,
                                marginTop: "2px",
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
                              <p style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a1a", marginBottom: "2px" }}>
                                {item.title}
                              </p>
                              {(item.departureTime || item.arrivalTime || item.fromCity || item.toCity || item.fromAirport || item.toAirport) && (
                                <p style={{ fontSize: "12px", color: "#888" }}>
                                  {[
                                    item.fromAirport && item.toAirport
                                      ? `${item.fromAirport} → ${item.toAirport}`
                                      : item.fromCity && item.toCity
                                      ? `${item.fromCity} → ${item.toCity}`
                                      : null,
                                    item.departureTime && item.arrivalTime
                                      ? `${item.departureTime} – ${item.arrivalTime}`
                                      : item.departureTime
                                      ? item.departureTime
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              )}
                              {item.address && (
                                <p style={{ fontSize: "12px", color: "#AAAAAA", marginTop: "2px" }}>{item.address}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Saved places for this day */}
                      {savedItems.map((item) => (
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
                          {(item.placePhotoUrl || item.mediaThumbnailUrl) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={(item.placePhotoUrl ?? item.mediaThumbnailUrl)!}
                              alt={item.rawTitle ?? ""}
                              style={{ width: "48px", height: "48px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a1a", marginBottom: "2px" }}>
                              {item.rawTitle ?? "Saved place"}
                            </p>
                            {item.rawDescription && (
                              <p style={{ fontSize: "12px", color: "#888", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                                {item.rawDescription}
                              </p>
                            )}
                            {item.categoryTags && item.categoryTags.length > 0 && (
                              <p style={{ fontSize: "11px", color: "#AAAAAA", marginTop: "2px" }}>
                                {item.categoryTags.slice(0, 3).join(" · ")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}

                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Unsorted saved places with photos */}
        {unsortedPhotos.length > 0 && (
          <section style={{ marginTop: "28px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", marginBottom: "16px" }}>
              Places saved
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "10px",
              }}
            >
              {unsortedPhotos.slice(0, 8).map((place) => {
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
                    <p
                      style={{
                        position: "absolute",
                        bottom: "8px",
                        left: "8px",
                        right: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#fff",
                        lineHeight: 1.2,
                      }}
                    >
                      {place.rawTitle}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {allDayIndices.length === 0 && unsortedPhotos.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "#AAAAAA" }}>
            <p style={{ fontSize: "15px" }}>This trip is being planned — check back soon.</p>
          </div>
        )}

      </div>

      {/* Bottom bar — auth-aware CTA */}
      <SharePageBottomBar tripId={trip.id} tripTitle={trip.title} />
    </div>
  );
}
