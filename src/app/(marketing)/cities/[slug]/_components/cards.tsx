// Compact read-only card components for the city/country/continent marketing pages.
// Canonical single render path per Discipline 4.42.

import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import { SpotImage } from "@/components/shared/SpotImage";
import { getTripCoverImage } from "@/lib/destination-images";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"] });

// ── Types ────────────────────────────────────────────────────────────────────

export interface CompactTripCardProps {
  id: string;
  title: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  heroImageUrl: string | null;
  shareToken: string | null;
  startDate: Date | null;
  endDate: Date | null;
  isAnonymous: boolean;
}

export interface CompactTourCardProps {
  id: string;
  title: string;
  destinationCity: string;
  destinationCountry: string | null;
  shareToken: string | null;
  stopCount: number;
  transport: string;
}

export interface CompactSpotCardProps {
  id: string;
  name: string;
  category: string | null;
  cuisine?: string | null;
  lodgingType?: string | null;
  photoUrl: string | null;
  averageRating: number | null;
  ratingCount: number;
  description: string | null;
}

// ── TripCard ─────────────────────────────────────────────────────────────────

function formatDateRange(start: Date | null, end: Date | null) {
  if (!start) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = start.toLocaleDateString("en-US", opts);
  if (!end) return s;
  return `${s} – ${end.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

export function TripCard({ trip }: { trip: CompactTripCardProps }) {
  const hero = getTripCoverImage(trip.destinationCity, trip.destinationCountry, trip.heroImageUrl);
  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  const href = trip.shareToken ? `/share/${trip.shareToken}` : `/trips/${trip.id}`;

  return (
    <Link href={href} style={{ textDecoration: "none", display: "block", width: "100%" }}>
      <div style={{
        backgroundColor: "#fff", borderRadius: "20px", overflow: "hidden",
        border: "1.5px solid #EEEEEE", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        height: "100%",
      }}>
        {/* Hero image with title overlay */}
        <div style={{
          height: "160px", position: "relative", overflow: "hidden",
          backgroundImage: `url('${hero}')`,
          backgroundSize: "cover", backgroundPosition: "center",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)" }} />
          {trip.isAnonymous && (
            <span style={{
              position: "absolute", top: "8px", left: "8px",
              fontSize: "10px", color: "rgba(255,255,255,0.7)",
              backgroundColor: "rgba(0,0,0,0.35)", borderRadius: "10px", padding: "2px 8px",
            }}>
              Anonymous
            </span>
          )}
          <div style={{ position: "absolute", bottom: "10px", left: "12px", right: "12px" }}>
            <p style={{
              fontSize: "16px", fontWeight: 800, color: "#fff",
              lineHeight: 1.25, margin: 0,
              textShadow: "0 1px 3px rgba(0,0,0,0.4)",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {trip.title}
            </p>
          </div>
        </div>

        {/* Metadata below image */}
        <div style={{ padding: "10px 12px" }}>
          {(trip.destinationCity || trip.destinationCountry) && (
            <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
              {[trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ")}
            </p>
          )}
          {dateRange && (
            <p style={{ fontSize: "11px", color: "#aaa", marginTop: "2px" }}>{dateRange}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── TourCard ─────────────────────────────────────────────────────────────────

const TOUR_FALLBACK = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80";

export function TourCard({ tour }: { tour: CompactTourCardProps }) {
  const href = tour.shareToken ? `/share/${tour.shareToken}` : `/tour`;

  return (
    <Link href={href} style={{ textDecoration: "none", display: "block", width: "100%" }}>
      <div style={{
        borderRadius: "16px", overflow: "hidden",
        border: "1.5px solid #EEEEEE", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        position: "relative",
        aspectRatio: "4/3",
        backgroundImage: `url('${TOUR_FALLBACK}')`,
        backgroundSize: "cover", backgroundPosition: "center",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.72) 100%)" }} />
        {/* Stop count chip */}
        <span style={{
          position: "absolute", top: "8px", left: "8px",
          fontSize: "10px", fontWeight: 600, color: "#fff",
          backgroundColor: "rgba(27,58,92,0.92)", borderRadius: "10px", padding: "2px 8px",
        }}>
          {tour.stopCount} {tour.stopCount === 1 ? "stop" : "stops"}
        </span>
        {/* Title and destination at bottom */}
        <div style={{ position: "absolute", bottom: "12px", left: "12px", right: "12px" }}>
          <p
            className={playfair.className}
            style={{
              fontSize: "18px", fontWeight: 700, color: "#fff",
              lineHeight: 1.25, margin: 0,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}
          >
            {tour.title}
          </p>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", marginTop: "4px", margin: "4px 0 0" }}>
            {[tour.destinationCity, tour.destinationCountry].filter(Boolean).join(", ")} · {tour.transport}
          </p>
        </div>
      </div>
    </Link>
  );
}

// ── SpotCard ──────────────────────────────────────────────────────────────────

export function SpotCard({ spot }: { spot: CompactSpotCardProps }) {
  return (
    <div style={{
      backgroundColor: "#fff", borderRadius: "16px", overflow: "hidden",
      border: "1.5px solid #EEEEEE", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      width: "100%",
    }}>
      <div style={{ height: "140px", overflow: "hidden", backgroundColor: "#f3f4f6" }}>
        <SpotImage
          spotId={spot.id}
          src={spot.photoUrl}
          category={spot.category}
          alt={spot.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          allowResolve={false}
        />
      </div>
      <div style={{ padding: "10px 12px" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "#1B3A5C", lineHeight: 1.3, margin: 0 }} className="line-clamp-2">
          {spot.name}
        </p>
        {(spot.cuisine ?? spot.lodgingType ?? spot.category) && (
          <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "3px", textTransform: "capitalize" }}>
            {(spot.cuisine ?? spot.lodgingType ?? spot.category)!.replace(/_/g, " ")}
          </p>
        )}
        {spot.ratingCount > 0 ? (
          <p style={{ fontSize: "11px", color: "#C4664A", marginTop: "3px" }}>
            {"★".repeat(Math.round(spot.averageRating ?? 0))}
            <span style={{ color: "#aaa", marginLeft: "4px" }}>
              {spot.averageRating?.toFixed(1)} · {spot.ratingCount} {spot.ratingCount === 1 ? "family" : "families"}
            </span>
          </p>
        ) : (
          <p style={{ fontSize: "11px", color: "#bbb", marginTop: "3px" }}>Not yet rated</p>
        )}
        {spot.description && (
          <p style={{ fontSize: "11px", color: "#666", marginTop: "4px", lineHeight: 1.4 }} className="line-clamp-2">
            {spot.description}
          </p>
        )}
      </div>
    </div>
  );
}
