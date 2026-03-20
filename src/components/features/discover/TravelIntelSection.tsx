"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Search, X, MapPin, Star, ExternalLink, ChevronRight } from "lucide-react";
import { KNOWN_CITIES } from "@/lib/destination-coords";

// ── Types ────────────────────────────────────────────────────────────────────

export type PlaceItem = {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  lat: number | null;
  lng: number | null;
  categoryTags: string[];
  websiteUrl: string | null;
  affiliateUrl: string | null;
  saveCount: number;
  avgRating: number | null;
  tips: Array<{ id: string; category: string; content: string }>;
  tripLinks: Array<{ id: string; title: string }>;
};

type UserTrip = {
  id: string;
  title: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  startDate: string | null;
};

// ── Constants ────────────────────────────────────────────────────────────────

const INTEL_CATEGORIES = ["All", "Restaurants", "Culture", "Outdoors", "Kids & Family", "Shopping", "Hotels"];

const TIP_LABELS: Record<string, string> = {
  secret:       "Best kept secret",
  mistake:      "Biggest mistake",
  kids:         "With kids",
  worth_it:     "Worth the money",
  not_worth_it: "Not worth it",
  would_return: "Would return",
  general:      "General tip",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function StarRow({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          style={{
            color: n <= Math.round(rating) ? "#F4A024" : "#E0E0E0",
            fill:  n <= Math.round(rating) ? "#F4A024" : "#E0E0E0",
          }}
        />
      ))}
      <span style={{ fontSize: "11px", color: "#717171", marginLeft: "4px" }}>{rating.toFixed(1)}</span>
    </div>
  );
}

function CategoryPill({ tag }: { tag: string }) {
  const label = tag.charAt(0).toUpperCase() + tag.slice(1);
  return (
    <span style={{
      fontSize: "10px", fontWeight: 700,
      backgroundColor: "#C4664A", color: "#fff",
      borderRadius: "20px", padding: "2px 8px",
    }}>
      {label}
    </span>
  );
}

function PhotoArea({ thumbnailUrl, title, height = 160 }: { thumbnailUrl: string | null; title: string; height?: number }) {
  const initial = (title[0] ?? "P").toUpperCase();
  if (thumbnailUrl) {
    return (
      <div style={{ height, position: "relative", overflow: "hidden" }}>
        <img
          src={thumbnailUrl}
          alt={title}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={(e) => {
            const parent = (e.target as HTMLImageElement).parentElement;
            if (parent) {
              parent.style.background = "linear-gradient(135deg, #1B3A5C 0%, #2d5a8e 100%)";
              (e.target as HTMLImageElement).style.display = "none";
            }
          }}
        />
      </div>
    );
  }
  return (
    <div style={{
      height, background: "linear-gradient(135deg, #1B3A5C 0%, #2d5a8e 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontSize: "48px", fontWeight: 900, color: "rgba(255,255,255,0.25)" }}>{initial}</span>
    </div>
  );
}

// ── Details Sheet ─────────────────────────────────────────────────────────────

function DetailsSheet({
  place,
  onClose,
  onAddToTrip,
}: {
  place: PlaceItem;
  onClose: () => void;
  onAddToTrip: (place: PlaceItem) => void;
}) {
  const destination = [place.destinationCity, place.destinationCountry].filter(Boolean).join(", ");
  const primaryTag = place.categoryTags[0] ?? null;
  const bookingUrl = place.affiliateUrl ?? place.websiteUrl;

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        backgroundColor: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      {/* Sheet */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "640px",
          backgroundColor: "#fff",
          borderRadius: "20px 20px 0 0",
          maxHeight: "90vh",
          display: "flex", flexDirection: "column",
          overflowY: "hidden",
        }}
      >
        {/* Hero image */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <PhotoArea thumbnailUrl={place.thumbnailUrl} title={place.title} height={200} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.4) 100%)" }} />
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: "12px", right: "12px", zIndex: 2,
              width: "32px", height: "32px", borderRadius: "50%",
              backgroundColor: "rgba(0,0,0,0.45)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={16} style={{ color: "#fff" }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 20px 32px" }}>
          {/* Title + meta */}
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#1B3A5C", margin: "0 0 8px", lineHeight: 1.2 }}>
            {place.title}
          </h2>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
            {primaryTag && <CategoryPill tag={primaryTag} />}
            {destination && (
              <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "12px", color: "#717171" }}>
                <MapPin size={11} style={{ color: "#C4664A" }} />
                {destination}
              </span>
            )}
          </div>

          {/* Avg rating */}
          {place.avgRating != null && (
            <div style={{ marginBottom: "14px" }}>
              <StarRow rating={place.avgRating} size={14} />
              <p style={{ fontSize: "11px", color: "#AAAAAA", margin: "3px 0 0" }}>Community average</p>
            </div>
          )}

          {/* Saved by */}
          {place.saveCount >= 2 && (
            <p style={{ fontSize: "12px", color: "#717171", marginBottom: "14px" }}>
              Saved by <strong style={{ color: "#1B3A5C" }}>{place.saveCount} families</strong>
            </p>
          )}

          {/* Description */}
          {place.description && (
            <p style={{ fontSize: "14px", color: "#444", lineHeight: 1.6, marginBottom: "20px" }}>
              {place.description}
            </p>
          )}

          {/* Tips */}
          {place.tips.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
                What families say
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {place.tips.map((tip) => (
                  <div
                    key={tip.id}
                    style={{
                      backgroundColor: "#F9F9F9", borderRadius: "10px",
                      padding: "12px 14px", border: "1px solid #F0F0F0",
                    }}
                  >
                    <span style={{
                      fontSize: "10px", fontWeight: 700, color: "#C4664A",
                      backgroundColor: "rgba(196,102,74,0.1)", borderRadius: "20px",
                      padding: "2px 8px", display: "inline-block", marginBottom: "6px",
                    }}>
                      {TIP_LABELS[tip.category] ?? tip.category}
                    </span>
                    <p style={{ fontSize: "13px", color: "#444", margin: 0, lineHeight: 1.5 }}>
                      {tip.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Featured in */}
          {place.tripLinks.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
                Featured in
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {place.tripLinks.map((trip) => (
                  <Link
                    key={trip.id}
                    href={`/trips/${trip.id}`}
                    onClick={onClose}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", backgroundColor: "#F9F9F9", borderRadius: "10px",
                      border: "1px solid #F0F0F0", textDecoration: "none",
                    }}
                  >
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#1B3A5C" }}>{trip.title}</span>
                    <ChevronRight size={14} style={{ color: "#AAAAAA" }} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Website link */}
          {place.websiteUrl && (
            <div style={{ marginBottom: "20px" }}>
              <a
                href={place.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "5px",
                  fontSize: "13px", color: "#1B3A5C", fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                <ExternalLink size={13} />
                Visit website
              </a>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
            <button
              onClick={() => { onClose(); onAddToTrip(place); }}
              style={{
                flex: 1, padding: "12px", borderRadius: "12px",
                border: "1.5px solid #C4664A", backgroundColor: "transparent",
                color: "#C4664A", fontSize: "14px", fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              + Add to Trip
            </button>
            {bookingUrl && (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1, padding: "12px", borderRadius: "12px",
                  backgroundColor: "#C4664A", color: "#fff",
                  fontSize: "14px", fontWeight: 700,
                  textDecoration: "none", textAlign: "center",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                Book this
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add-to-Trip Modal ─────────────────────────────────────────────────────────

function AddToTripModal({
  place,
  onClose,
}: {
  place: PlaceItem;
  onClose: () => void;
}) {
  const { isSignedIn } = useUser();
  const [trips, setTrips] = useState<UserTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adding, setAdding] = useState<string | "unorganized" | null>(null);
  const [successMsg, setSuccessMsg] = useState<{ text: string; tripId?: string } | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (!isSignedIn) { setIsLoading(false); return; }
    fetch("/api/trips")
      .then((r) => r.json())
      .then((d) => setTrips(Array.isArray(d.trips) ? d.trips : []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [isSignedIn]);

  const cityLower = (place.destinationCity ?? "").toLowerCase();
  const matchingTrips = trips.filter(
    (t) => (t.destinationCity ?? "").toLowerCase() === cityLower && cityLower !== ""
  );
  const displayTrips = matchingTrips.length > 0 ? matchingTrips : trips;

  async function addToTrip(tripId: string | null) {
    const key = tripId ?? "unorganized";
    setAdding(key);
    const sourceUrl = place.websiteUrl ?? place.affiliateUrl ?? "https://flokktravel.com/discover";
    try {
      const res = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url:          sourceUrl,
          tripId:       tripId ?? undefined,
          title:        place.title,
          description:  place.description ?? undefined,
          thumbnailUrl: place.thumbnailUrl ?? undefined,
          tags:         place.categoryTags,
          lat:          place.lat ?? undefined,
          lng:          place.lng ?? undefined,
        }),
      });
      if (res.ok) {
        const tripName = tripId ? trips.find((t) => t.id === tripId)?.title : null;
        setSuccessMsg(
          tripId
            ? { text: `Added to ${tripName ?? "your trip"}`, tripId }
            : { text: "Saved to your Saves tab" }
        );
        setTimeout(() => { setSuccessMsg(null); onClose(); }, 2000);
      }
    } catch {
      // silently fail
    } finally {
      setAdding(null);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 600,
        backgroundColor: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "400px",
          backgroundColor: "#fff", borderRadius: "20px",
          padding: "24px", boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#1a1a1a", margin: 0 }}>Add to trip</h3>
            <p style={{ fontSize: "13px", color: "#717171", margin: "3px 0 0" }}>{place.title}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", padding: "0 0 0 12px", fontSize: "20px", lineHeight: 1 }}>×</button>
        </div>

        {/* Success */}
        {successMsg && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#1B3A5C", marginBottom: "6px" }}>Done!</p>
            {successMsg.tripId ? (
              <Link href={`/trips/${successMsg.tripId}`} style={{ fontSize: "13px", color: "#C4664A", textDecoration: "none" }}>
                {successMsg.text} →
              </Link>
            ) : (
              <p style={{ fontSize: "13px", color: "#717171" }}>{successMsg.text}</p>
            )}
          </div>
        )}

        {/* Not signed in */}
        {!successMsg && !isSignedIn && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <p style={{ fontSize: "14px", color: "#717171", marginBottom: "16px" }}>Sign in to save places to your trips</p>
            <Link
              href="/sign-in"
              style={{ display: "inline-block", padding: "10px 24px", backgroundColor: "#1B3A5C", color: "#fff", fontSize: "14px", fontWeight: 700, borderRadius: "12px", textDecoration: "none" }}
            >
              Sign in
            </Link>
          </div>
        )}

        {/* Loading */}
        {!successMsg && isSignedIn && isLoading && (
          <p style={{ fontSize: "14px", color: "#AAAAAA", textAlign: "center", padding: "16px 0" }}>Loading your trips…</p>
        )}

        {/* Trip list */}
        {!successMsg && isSignedIn && !isLoading && (
          <div>
            {displayTrips.length === 0 ? (
              <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                <p style={{ fontSize: "14px", color: "#717171", marginBottom: "16px" }}>No active trips. Save for later?</p>
              </div>
            ) : (
              <>
                {matchingTrips.length === 0 && trips.length > 0 && (
                  <p style={{ fontSize: "12px", color: "#AAAAAA", marginBottom: "10px" }}>No trips match this destination — choose one:</p>
                )}
                {matchingTrips.length > 0 && (
                  <p style={{ fontSize: "12px", color: "#6B8F71", fontWeight: 600, marginBottom: "10px" }}>Matches your destination:</p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
                  {displayTrips.map((trip) => (
                    <button
                      key={trip.id}
                      onClick={() => addToTrip(trip.id)}
                      disabled={adding !== null}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 14px", backgroundColor: "#F9F9F9", borderRadius: "12px",
                        border: "1px solid #EEEEEE", cursor: "pointer",
                        opacity: adding && adding !== trip.id ? 0.4 : 1,
                        fontFamily: "inherit", textAlign: "left", transition: "opacity 0.15s",
                      }}
                    >
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", margin: 0 }}>{trip.title}</p>
                        {trip.destinationCity && (
                          <p style={{ fontSize: "11px", color: "#717171", margin: "2px 0 0" }}>{trip.destinationCity}</p>
                        )}
                      </div>
                      <span style={{ fontSize: "12px", color: "#C4664A", fontWeight: 600, whiteSpace: "nowrap", marginLeft: "8px" }}>
                        {adding === trip.id ? "Adding…" : "Add →"}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Save for later */}
            <button
              onClick={() => addToTrip(null)}
              disabled={adding !== null}
              style={{
                width: "100%", padding: "11px", borderRadius: "12px",
                border: "1.5px solid #EEEEEE", backgroundColor: "transparent",
                color: "#717171", fontSize: "13px", fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                opacity: adding === "unorganized" ? 0.4 : 1,
              }}
            >
              {adding === "unorganized" ? "Saving…" : "Save for later (no trip)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Place Card ────────────────────────────────────────────────────────────────

function PlaceCard({
  place,
  onDetails,
  onAddToTrip,
}: {
  place: PlaceItem;
  onDetails: (p: PlaceItem) => void;
  onAddToTrip: (p: PlaceItem) => void;
}) {
  const primaryTag = place.categoryTags[0] ?? null;
  const location   = [place.destinationCity, place.destinationCountry].filter(Boolean).join(", ");

  return (
    <div
      className="hover:shadow-md transition-shadow duration-200"
      style={{
        backgroundColor: "#fff", borderRadius: "16px",
        overflow: "hidden", border: "1px solid #EEEEEE",
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Image */}
      <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden" }}>
        <PhotoArea thumbnailUrl={place.thumbnailUrl} title={place.title} height={0} />
        <div style={{ position: "absolute", inset: 0 }}>
          <PhotoArea thumbnailUrl={place.thumbnailUrl} title={place.title} height={180} />
        </div>
        {primaryTag && (
          <div style={{ position: "absolute", top: "8px", left: "8px", zIndex: 1 }}>
            <CategoryPill tag={primaryTag} />
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
        <p style={{
          fontSize: "14px", fontWeight: 700, color: "#1B3A5C",
          margin: "0 0 4px", lineHeight: 1.3,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {place.title}
        </p>

        {location && (
          <div style={{ display: "flex", alignItems: "center", gap: "3px", marginBottom: "6px" }}>
            <MapPin size={10} style={{ color: "#C4664A", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: "#717171" }}>{location}</span>
          </div>
        )}

        {place.saveCount >= 2 && (
          <p style={{ fontSize: "11px", color: "#AAAAAA", marginBottom: "6px" }}>
            Saved by <strong style={{ color: "#1B3A5C" }}>{place.saveCount}</strong> families
          </p>
        )}

        {place.avgRating != null && (
          <div style={{ marginBottom: "8px" }}>
            <StarRow rating={place.avgRating} />
          </div>
        )}

        <div style={{ marginTop: "auto", display: "flex", gap: "8px", paddingTop: "10px" }}>
          <button
            onClick={() => onAddToTrip(place)}
            style={{
              flex: 1, padding: "8px 6px", borderRadius: "10px",
              border: "1.5px solid #C4664A", backgroundColor: "transparent",
              color: "#C4664A", fontSize: "12px", fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            + Add to Trip
          </button>
          <button
            onClick={() => onDetails(place)}
            style={{
              flex: 1, padding: "8px 6px", borderRadius: "10px",
              border: "1.5px solid #E0E0E0", backgroundColor: "transparent",
              color: "#1B3A5C", fontSize: "12px", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Details →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────────

export function TravelIntelSection() {
  const [city,            setCity]            = useState("");
  const [suggestions,    setSuggestions]     = useState<string[]>([]);
  const [showSuggestions,setShowSuggestions]  = useState(false);
  const [appliedCity,    setAppliedCity]     = useState("");
  const [category,       setCategory]        = useState("All");
  const [places,         setPlaces]          = useState<PlaceItem[]>([]);
  const [total,          setTotal]           = useState(0);
  const [offset,         setOffset]          = useState(0);
  const [isLoading,      setIsLoading]       = useState(true);
  const [selectedPlace,  setSelectedPlace]   = useState<PlaceItem | null>(null);
  const [addToTripPlace, setAddToTripPlace]  = useState<PlaceItem | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // City autocomplete
  useEffect(() => {
    if (city.length < 2) { setSuggestions([]); return; }
    const q = city.toLowerCase();
    setSuggestions(KNOWN_CITIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 6));
  }, [city]);

  // Dismiss suggestions on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Fetch places when filters change
  const fetchPlaces = useCallback(async (cityParam: string, catParam: string, off: number, append = false) => {
    setIsLoading(!append);
    const params = new URLSearchParams();
    if (cityParam) params.set("city", cityParam);
    if (catParam && catParam !== "All") params.set("category", catParam.toLowerCase());
    if (off > 0) params.set("offset", String(off));
    try {
      const res  = await fetch(`/api/travel-intel?${params.toString()}`);
      const data = await res.json() as { places: PlaceItem[]; total: number };
      setPlaces(append ? (prev) => [...prev, ...(data.places ?? [])] : (data.places ?? []));
      setTotal(data.total ?? 0);
    } catch {
      if (!append) setPlaces([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setOffset(0);
    fetchPlaces(appliedCity, category, 0, false);
  }, [appliedCity, category, fetchPlaces]);

  function applyCity(val: string) {
    setCity(val);
    setAppliedCity(val);
    setShowSuggestions(false);
    setOffset(0);
  }

  function clearCity() {
    setCity("");
    setAppliedCity("");
    setSuggestions([]);
    setShowSuggestions(false);
    setOffset(0);
  }

  function loadMore() {
    const newOffset = offset + 50;
    setOffset(newOffset);
    fetchPlaces(appliedCity, category, newOffset, true);
  }

  const hasMore = total > offset + 50;

  return (
    <div style={{ marginBottom: "48px" }}>
      {/* Section header */}
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#1B3A5C", margin: "0 0 4px", lineHeight: 1.2 }}>
          Travel Intel
        </h2>
        <p style={{ fontSize: "13px", color: "#717171", margin: 0 }}>
          Places families actually went — searchable by destination
        </p>
      </div>

      {/* City search */}
      <div ref={searchRef} style={{ position: "relative", marginBottom: "14px" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Search size={15} style={{ position: "absolute", left: "14px", color: "#AAAAAA", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search a city or country…"
            value={city}
            onChange={(e) => { setCity(e.target.value); setShowSuggestions(true); if (!e.target.value) clearCity(); }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { applyCity(city); }
              if (e.key === "Escape") { clearCity(); }
            }}
            style={{
              width: "100%", padding: "11px 44px",
              borderRadius: "999px", border: "1.5px solid #E5E5E5",
              fontSize: "14px", color: "#1a1a1a", backgroundColor: "#F9F9F9",
              outline: "none", boxSizing: "border-box", fontFamily: "inherit",
            }}
          />
          {city && (
            <button onClick={clearCity} style={{ position: "absolute", right: "14px", background: "none", border: "none", cursor: "pointer", color: "#AAAAAA", padding: "2px", display: "flex" }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            backgroundColor: "#fff", border: "1.5px solid #E5E5E5", borderRadius: "14px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)", zIndex: 100, overflow: "hidden",
          }}>
            {suggestions.map((c) => (
              <button
                key={c}
                onMouseDown={() => applyCity(c)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px", width: "100%",
                  padding: "10px 16px", background: "none", border: "none",
                  cursor: "pointer", textAlign: "left", fontSize: "14px", color: "#1a1a1a",
                  fontFamily: "inherit",
                }}
              >
                <MapPin size={12} style={{ color: "#C4664A", flexShrink: 0 }} />
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category pills */}
      <div
        style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "14px", scrollbarWidth: "none", msOverflowStyle: "none" }}
        className="hide-scrollbar"
      >
        {INTEL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              flexShrink: 0, padding: "7px 16px", borderRadius: "999px",
              border:           category === cat ? "none"              : "1.5px solid #E0E0E0",
              backgroundColor:  category === cat ? "#C4664A"           : "#fff",
              color:            category === cat ? "#fff"              : "#717171",
              fontSize: "13px", fontWeight: category === cat ? 700 : 500,
              cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid or states */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: "16px" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ borderRadius: "16px", backgroundColor: "#F5F5F5", height: "280px", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : places.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", backgroundColor: "#F9F9F9", borderRadius: "16px", border: "1px solid #EEEEEE" }}>
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#1a1a1a", marginBottom: "6px" }}>
            {appliedCity ? `No places found for ${appliedCity}` : "No places yet"}
          </p>
          <p style={{ fontSize: "13px", color: "#717171", marginBottom: "16px" }}>
            {appliedCity ? "Be the first to add a trip here." : "Places will appear as families share their completed trips."}
          </p>
          <Link
            href="/trips/past/new"
            style={{
              display: "inline-block", padding: "10px 24px",
              backgroundColor: "#C4664A", color: "#fff",
              fontSize: "13px", fontWeight: 700, borderRadius: "999px", textDecoration: "none",
            }}
          >
            Add a past trip →
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: "16px" }}>
            {places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                onDetails={setSelectedPlace}
                onAddToTrip={setAddToTripPlace}
              />
            ))}
          </div>

          {hasMore && (
            <div style={{ textAlign: "center", marginTop: "24px" }}>
              <button
                onClick={loadMore}
                style={{
                  padding: "11px 28px", borderRadius: "999px",
                  border: "1.5px solid #E0E0E0", backgroundColor: "#fff",
                  fontSize: "13px", fontWeight: 600, color: "#1B3A5C",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Load more places
              </button>
            </div>
          )}
        </>
      )}

      {/* Details sheet */}
      {selectedPlace && (
        <DetailsSheet
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
          onAddToTrip={(p) => { setSelectedPlace(null); setAddToTripPlace(p); }}
        />
      )}

      {/* Add to trip modal */}
      {addToTripPlace && (
        <AddToTripModal
          place={addToTripPlace}
          onClose={() => setAddToTripPlace(null)}
        />
      )}
    </div>
  );
}
