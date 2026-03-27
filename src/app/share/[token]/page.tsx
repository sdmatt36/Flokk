import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getTripCoverImage } from "@/lib/destination-images";
import { MapPin, Calendar, Plane, Train, BedDouble, Zap } from "lucide-react";
import { SharePageBottomBar } from "./SharePageBottomBar";

export const dynamic = "force-dynamic";

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

const TYPE_ICON: Record<string, React.ReactNode> = {
  FLIGHT: <Plane size={13} />,
  TRAIN: <Train size={13} />,
  LODGING: <BedDouble size={13} />,
  ACTIVITY: <Zap size={13} />,
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

  // Build day labels
  const tripStart = trip.startDate;
  function dayLabel(idx: number): string {
    if (tripStart) {
      const d = new Date(tripStart);
      d.setDate(d.getDate() + (idx - 1));
      const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      return `Day ${idx} · ${label}`;
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

  // Saved places with photos
  const savedPlaces = trip.savedItems.filter(
    (s) => s.placePhotoUrl || s.mediaThumbnailUrl
  );

  const allDayIndices = [
    ...new Set([
      ...Object.keys(itineraryByDay).map(Number),
    ]),
  ].sort((a, b) => a - b);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "100px" }}>
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
              marginBottom: "6px",
              textShadow: "0 2px 12px rgba(0,0,0,0.4)",
            }}
          >
            {trip.title}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {(trip.destinationCity || trip.destinationCountry) && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <MapPin size={13} style={{ color: "rgba(255,255,255,0.8)" }} />
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>
                  {[trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
            {dateRange && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Calendar size={13} style={{ color: "rgba(255,255,255,0.8)" }} />
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>
                  {dateRange}
                </span>
              </div>
            )}
          </div>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)", marginTop: "6px" }}>
            Shared by {curatorName} · {days ?? "—"} days
          </p>
        </div>
      </div>

      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "0 16px" }}>

        {/* Itinerary */}
        {allDayIndices.length > 0 && (
          <section style={{ marginTop: "28px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", marginBottom: "16px" }}>
              Itinerary
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {allDayIndices.map((di) => {
                const items = itineraryByDay[di] ?? [];
                return (
                  <div key={di}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
                      {dayLabel(di)}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {items.map((item) => (
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
                              width: "28px",
                              height: "28px",
                              borderRadius: "8px",
                              backgroundColor: item.type === "FLIGHT" ? "#EEF4FF" : item.type === "LODGING" ? "#FFF4EE" : item.type === "TRAIN" ? "#F0FFF4" : "#F5F5F5",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              color: item.type === "FLIGHT" ? "#3B82F6" : item.type === "LODGING" ? "#C4664A" : item.type === "TRAIN" ? "#6B8F71" : "#888",
                            }}
                          >
                            {TYPE_ICON[item.type] ?? <Zap size={13} />}
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
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Saved places */}
        {savedPlaces.length > 0 && (
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
              {savedPlaces.slice(0, 8).map((place) => {
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
        {allDayIndices.length === 0 && savedPlaces.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "#AAAAAA" }}>
            <p style={{ fontSize: "15px" }}>This trip is being planned — check back soon.</p>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <SharePageBottomBar tripId={trip.id} tripTitle={trip.title} />
    </div>
  );
}
