import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Plus, MapPin, Calendar, Map } from "lucide-react";
import { BottomNav } from "@/components/ui/BottomNav";

function formatDateRange(start: Date | null, end: Date | null) {
  if (!start) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = start.toLocaleDateString("en-US", opts);
  if (!end) return startStr;
  const endStr = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${startStr} – ${endStr}`;
}

const STATUS_LABEL: Record<string, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  COMPLETED: "Completed",
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  PLANNING: { bg: "rgba(107,143,113,0.15)", text: "#6B8F71" },
  ACTIVE: { bg: "rgba(196,102,74,0.15)", text: "#C4664A" },
  COMPLETED: { bg: "rgba(113,113,113,0.12)", text: "#717171" },
};

const DESTINATION_GRADIENTS: string[] = [
  "linear-gradient(135deg, #6B8F71 0%, #4a7050 100%)",
  "linear-gradient(135deg, #C4664A 0%, #a34c32 100%)",
  "linear-gradient(135deg, #7a8fa0 0%, #5a6f80 100%)",
  "linear-gradient(135deg, #9b7e6b 0%, #7a5e4e 100%)",
];

export default async function TripsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: {
      familyProfile: {
        include: {
          trips: {
            orderBy: { startDate: "asc" },
            include: {
              _count: { select: { savedItems: true } },
            },
          },
        },
      },
    },
  });

  if (!user?.familyProfile) redirect("/onboarding");

  const trips = user.familyProfile.trips;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "96px" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "32px 24px 0" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#1a1a1a", marginBottom: "4px" }}>
              Your trips
            </h1>
            <p style={{ fontSize: "14px", color: "#717171" }}>
              {trips.length > 0
                ? `${trips.length} ${trips.length === 1 ? "trip" : "trips"} planned`
                : "Plan your next adventure."}
            </p>
          </div>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "#C4664A",
              color: "#fff",
              border: "none",
              borderRadius: "20px",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
              marginTop: "4px",
            }}
          >
            <Plus size={15} />
            New trip
          </button>
        </div>

        {/* Trip cards */}
        {trips.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {trips.map((trip, i) => {
              const gradient = DESTINATION_GRADIENTS[i % DESTINATION_GRADIENTS.length];
              const status = STATUS_COLOR[trip.status] ?? STATUS_COLOR.PLANNING;
              const dateRange = formatDateRange(trip.startDate, trip.endDate);

              return (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: "20px",
                      overflow: "hidden",
                      border: "1.5px solid #EEEEEE",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    }}
                  >
                    {/* Hero photo */}
                    <div style={{ height: "110px", position: "relative", overflow: "hidden", backgroundImage: "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80')", backgroundSize: "cover", backgroundPosition: "center" }}>
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)" }} />
                      {/* Title */}
                      <div style={{ position: "absolute", bottom: "12px", left: "16px", zIndex: 2 }}>
                        <p style={{ fontSize: "20px", fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
                          {trip.title}
                        </p>
                      </div>
                      {/* Status pill */}
                      <div
                        style={{
                          position: "absolute", top: "12px", right: "12px", zIndex: 2,
                          backgroundColor: "rgba(255,255,255,0.92)", borderRadius: "20px", padding: "3px 10px",
                        }}
                      >
                        <span style={{ fontSize: "11px", fontWeight: 700, color: status.text }}>
                          {STATUS_LABEL[trip.status]}
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {(trip.destinationCity || trip.destinationCountry) && (
                          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                            <MapPin size={13} style={{ color: "#C4664A", flexShrink: 0 }} />
                            <span style={{ fontSize: "13px", color: "#2d2d2d", fontWeight: 600 }}>
                              {[trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        )}
                        {dateRange && (
                          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                            <Calendar size={13} style={{ color: "#717171", flexShrink: 0 }} />
                            <span style={{ fontSize: "13px", color: "#717171" }}>{dateRange}</span>
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "20px", fontWeight: 800, color: "#C4664A", lineHeight: 1 }}>
                          {trip._count.savedItems}
                        </p>
                        <p style={{ fontSize: "11px", color: "#717171", marginTop: "2px" }}>
                          {trip._count.savedItems === 1 ? "place" : "places"}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              backgroundColor: "#F5F5F5",
              borderRadius: "20px",
              borderLeft: "4px solid #C4664A",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              padding: "28px 24px",
            }}
          >
            <Map size={32} style={{ color: "#C4664A", marginBottom: "12px" }} />
            <p style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>
              No trips yet
            </p>
            <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5, marginBottom: "16px" }}>
              Start planning your first trip — add a destination, dates, and your saved places.
            </p>
            <button
              style={{
                backgroundColor: "transparent",
                border: "1.5px solid #C4664A",
                borderRadius: "20px",
                padding: "8px 20px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#C4664A",
                cursor: "pointer",
              }}
            >
              Plan a trip
            </button>
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  );
}
