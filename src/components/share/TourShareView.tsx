"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ExternalLink, Clock, Footprints } from "lucide-react";

const TourMapBlock = dynamic(() => import("@/components/tours/TourMapBlock"), { ssr: false });

const NAVY = "#1B3A5C";
const TERRA = "#C4664A";
const GRAY = "#6B7280";

type Stop = {
  id: string;
  orderIndex: number;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  durationMin: number | null;
  travelTimeMin: number | null;
  why: string | null;
  familyNote: string | null;
  imageUrl: string | null;
  websiteUrl: string | null;
  ticketRequired: string | null;
  placeTypes: string[];
};

interface Props {
  stops: Stop[];
  transport: string;
}

export function TourShareView({ stops, transport }: Props) {
  const mapStops = stops.map((s) => ({ name: s.name, lat: s.lat, lng: s.lng }));

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "20px 16px 0" }}>
      <TourMapBlock stops={mapStops} />

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "32px" }}>
        {stops.map((stop, idx) => (
          <div
            key={stop.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              border: "1px solid #F3F4F6",
              borderRadius: "16px",
              overflow: "hidden",
              backgroundColor: "#fff",
            }}
          >
            <div
              style={{
                width: "96px",
                height: "96px",
                flexShrink: 0,
                backgroundColor: "#F3F4F6",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {stop.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={stop.imageUrl}
                  alt={stop.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: "18px", fontWeight: 700, color: "#D1D5DB" }}>{idx + 1}</span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0, padding: "10px 12px 10px 10px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    backgroundColor: TERRA,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: "10px",
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  {idx + 1}
                </div>
                <p style={{ fontSize: "14px", fontWeight: 600, color: NAVY, margin: 0, lineHeight: 1.3 }}>
                  {stop.name}
                </p>
              </div>

              {stop.websiteUrl && (
                <a
                  href={stop.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    fontSize: "12px",
                    color: TERRA,
                    textDecoration: "none",
                    marginTop: "4px",
                  }}
                >
                  <ExternalLink size={12} />
                  Link
                </a>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                {stop.durationMin && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                      backgroundColor: "#F3F4F6",
                      borderRadius: "999px",
                      padding: "2px 8px",
                      fontSize: "11px",
                      color: GRAY,
                    }}
                  >
                    <Clock size={10} />
                    {stop.durationMin} min
                  </span>
                )}
                {transport === "Walking" && idx > 0 && (stop.travelTimeMin ?? 0) > 0 && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                      backgroundColor: "#F3F4F6",
                      borderRadius: "999px",
                      padding: "2px 8px",
                      fontSize: "11px",
                      color: GRAY,
                    }}
                  >
                    <Footprints size={10} />
                    {stop.travelTimeMin} min walk
                  </span>
                )}
                {stop.ticketRequired === "ticket-required" && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "#92400E",
                      backgroundColor: "#FEF3C7",
                      borderRadius: "999px",
                      padding: "2px 8px",
                    }}
                  >
                    Ticket required
                  </span>
                )}
                {stop.ticketRequired === "advance-booking-recommended" && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "#92400E",
                      backgroundColor: "#FEF3C7",
                      borderRadius: "999px",
                      padding: "2px 8px",
                    }}
                  >
                    Book ahead
                  </span>
                )}
                {stop.ticketRequired === "free" && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "#065F46",
                      backgroundColor: "#D1FAE5",
                      borderRadius: "999px",
                      padding: "2px 8px",
                    }}
                  >
                    Free
                  </span>
                )}
              </div>

              {stop.why && (
                <p
                  style={{
                    fontSize: "12px",
                    color: GRAY,
                    margin: "4px 0 0",
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {stop.why}
                </p>
              )}
              {stop.familyNote && (
                <p
                  style={{
                    fontSize: "12px",
                    color: TERRA,
                    fontStyle: "italic",
                    margin: "2px 0 0",
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {stop.familyNote}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", padding: "24px 0 40px", borderTop: "1px solid #F0F0F0" }}>
        <p style={{ fontSize: "14px", color: GRAY, marginBottom: "12px" }}>
          Build your own stop-by-stop tour, free.
        </p>
        <Link
          href="/tour"
          style={{
            display: "inline-block",
            padding: "12px 28px",
            backgroundColor: TERRA,
            color: "#fff",
            fontSize: "14px",
            fontWeight: 700,
            borderRadius: "999px",
            textDecoration: "none",
          }}
        >
          Create your own tour
        </Link>
      </div>
    </div>
  );
}
