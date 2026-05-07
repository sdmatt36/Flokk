"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { getTripCoverImage } from "@/lib/destination-images";

export interface CommunityTripCardTrip {
  id: string;
  title: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  shareToken: string | null;
  heroImageUrl?: string | null;
  isAnonymous: boolean;
  familyProfile: { familyName: string | null } | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

export function CommunityTripCard({ trip }: { trip: CommunityTripCardTrip }) {
  const coverImage = getTripCoverImage(trip.destinationCity, trip.destinationCountry, trip.heroImageUrl ?? null);
  const nights = trip.startDate && trip.endDate
    ? Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const destination = [trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ");
  const familyName = trip.isAnonymous || !trip.familyProfile?.familyName
    ? "A Flokk Family"
    : `${trip.familyProfile.familyName} Family`;
  const cardHref = trip.shareToken ? `/share/${trip.shareToken}` : `/trips/${trip.id}`;

  return (
    <Link href={cardHref} style={{ textDecoration: "none", display: "block" }}>
      <div
        className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        style={{ backgroundColor: "#fff", borderRadius: "16px", overflow: "hidden", border: "1px solid #EEEEEE", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
      >
        <div style={{ height: "160px", backgroundImage: `url(${coverImage})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
          <div style={{ position: "absolute", top: "10px", left: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#C4664A", color: "#fff", borderRadius: "20px", padding: "3px 10px" }}>
              {trip.destinationCity ?? destination}
            </span>
          </div>
          {trip.shareToken && (
            <div style={{ position: "absolute", top: "10px", right: "10px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, backgroundColor: "rgba(27,58,92,0.85)", backdropFilter: "blur(4px)", color: "#fff", borderRadius: "20px", padding: "3px 10px" }}>
                Community trip
              </span>
            </div>
          )}
        </div>
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", minHeight: "120px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
            <MapPin size={12} style={{ color: "#C4664A", flexShrink: 0 }} />
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>{trip.title}</span>
          </div>
          <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.5, marginBottom: "10px" }}>
            {[familyName, nights ? `${nights} nights` : null].filter(Boolean).join(" · ")}
          </p>
          <p style={{ fontSize: "11px", color: "#C4664A", lineHeight: 1.4, fontWeight: 500, marginTop: "auto" }}>
            {trip.shareToken ? "Steal days →" : "View trip →"}
          </p>
        </div>
      </div>
    </Link>
  );
}
