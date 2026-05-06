// Read-only compact card components for the city page.
// These are the canonical card definitions that /countries/[slug] and
// /continents/[slug] will import — no parallel render paths (Discipline 4.42).

import Link from "next/link";
import { SpotImage } from "@/components/shared/SpotImage";
import { getTripCoverImage } from "@/lib/destination-images";

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
    <Link href={href} style={{ textDecoration: "none", display: "block", flexShrink: 0, width: "280px" }}>
      <div style={{
        backgroundColor: "#fff", borderRadius: "16px", overflow: "hidden",
        border: "1.5px solid #EEEEEE", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        height: "100%",
      }}>
        <div style={{
          height: "140px", position: "relative", overflow: "hidden",
          backgroundImage: `url('${hero}')`,
          backgroundSize: "cover", backgroundPosition: "center",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%)" }} />
          {trip.isAnonymous && (
            <span style={{
              position: "absolute", bottom: "8px", left: "8px",
              fontSize: "10px", color: "rgba(255,255,255,0.7)",
              backgroundColor: "rgba(0,0,0,0.35)", borderRadius: "10px", padding: "2px 8px",
            }}>
              Anonymous
            </span>
          )}
        </div>
        <div style={{ padding: "12px 14px" }}>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, margin: 0 }} className="line-clamp-2">
            {trip.title}
          </p>
          {(trip.destinationCity || trip.destinationCountry) && (
            <p style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
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
    <Link href={href} style={{ textDecoration: "none", display: "block", flexShrink: 0, width: "280px" }}>
      <div style={{
        backgroundColor: "#fff", borderRadius: "16px", overflow: "hidden",
        border: "1.5px solid #EEEEEE", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        height: "100%",
      }}>
        <div style={{
          height: "140px", backgroundImage: `url('${TOUR_FALLBACK}')`,
          backgroundSize: "cover", backgroundPosition: "center", position: "relative",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.45) 100%)" }} />
          <span style={{
            position: "absolute", bottom: "8px", left: "8px",
            fontSize: "10px", color: "#fff",
            backgroundColor: "#C4664A", borderRadius: "10px", padding: "2px 8px",
          }}>
            Tour
          </span>
        </div>
        <div style={{ padding: "12px 14px" }}>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, margin: 0 }} className="line-clamp-2">
            {tour.title}
          </p>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
            {[tour.destinationCity, tour.destinationCountry].filter(Boolean).join(", ")}
          </p>
          <p style={{ fontSize: "11px", color: "#aaa", marginTop: "2px" }}>
            {tour.stopCount} {tour.stopCount === 1 ? "stop" : "stops"} · {tour.transport}
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
      flexShrink: 0, width: "240px",
    }}>
      <div style={{ height: "120px", overflow: "hidden", backgroundColor: "#f3f4f6" }}>
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
        <p style={{ fontSize: "13px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, margin: 0 }} className="line-clamp-2">
          {spot.name}
        </p>
        {spot.category && (
          <p style={{ fontSize: "11px", color: "#888", marginTop: "3px", textTransform: "capitalize" }}>
            {spot.category.replace(/_/g, " ")}
          </p>
        )}
        {spot.ratingCount > 0 ? (
          <p style={{ fontSize: "11px", color: "#C4664A", marginTop: "3px" }}>
            {"★".repeat(Math.round(spot.averageRating ?? 0))}
            <span style={{ color: "#aaa", marginLeft: "4px" }}>
              {spot.averageRating?.toFixed(1)} ({spot.ratingCount})
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
