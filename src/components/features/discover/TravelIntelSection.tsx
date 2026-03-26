"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Search, X, MapPin, Star, ExternalLink, ChevronRight } from "lucide-react";
import { Playfair_Display } from "next/font/google";
import { KNOWN_CITIES } from "@/lib/destination-coords";
import { getTripCoverImage } from "@/lib/destination-images";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"] });

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

const CATEGORY_IMAGES: Record<string, string> = {
  restaurant:    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
  food:          "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
  dining:        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
  cafe:          "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
  bar:           "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
  culture:       "https://images.unsplash.com/photo-1566127992631-137a642a90f4?w=800&q=80",
  museum:        "https://images.unsplash.com/photo-1566127992631-137a642a90f4?w=800&q=80",
  temple:        "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80",
  shrine:        "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80",
  history:       "https://images.unsplash.com/photo-1566127992631-137a642a90f4?w=800&q=80",
  outdoors:      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
  nature:        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
  hiking:        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
  park:          "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=800&q=80",
  beach:         "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
  kids:          "https://images.unsplash.com/photo-1526634332515-d56c5fd16991?w=800&q=80",
  family:        "https://images.unsplash.com/photo-1526634332515-d56c5fd16991?w=800&q=80",
  shopping:      "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80",
  market:        "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80",
  hotel:         "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
  accommodation: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
  resort:        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
  spa:           "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80",
  entertainment: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=80",
  nightlife:     "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=80",
};

// Pool of varied place images used when both thumbnail and category are unavailable
const PLACE_FALLBACK_POOL = [
  "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80", // Asia street
  "https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=800&q=80", // city lights
  "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80", // market
  "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80", // paris street
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80", // food
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80", // travel
  "https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=800&q=80", // temple
  "https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=800&q=80", // outdoor
];

function hashTitle(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return h;
}

function getCategoryFallback(categoryTags: string[], title = ""): string | null {
  for (const tag of categoryTags) {
    const key = tag.toLowerCase().trim();
    if (CATEGORY_IMAGES[key]) return CATEGORY_IMAGES[key];
    const match = Object.keys(CATEGORY_IMAGES).find(k => key.includes(k) || k.includes(key));
    if (match) return CATEGORY_IMAGES[match];
  }
  // Deterministic per-title fallback so each card looks different
  if (title) return PLACE_FALLBACK_POOL[hashTitle(title) % PLACE_FALLBACK_POOL.length];
  return null;
}

function PhotoArea({
  thumbnailUrl,
  title,
  height = 160,
  destinationCity,
  destinationCountry,
  categoryTags = [],
}: {
  thumbnailUrl: string | null;
  title: string;
  height?: number;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  categoryTags?: string[];
}) {
  const validThumbnail =
    thumbnailUrl &&
    thumbnailUrl.trim() !== "" &&
    !thumbnailUrl.includes("unsplash.com/photo-undefined") &&
    !thumbnailUrl.startsWith("https://unsplash.com/") // page URL, not a CDN image
      ? thumbnailUrl
      : null;
  const imgSrc = validThumbnail ?? getCategoryFallback(categoryTags, title) ?? getTripCoverImage(destinationCity, destinationCountry, null);
  return (
    <div style={{ height, overflow: "hidden", backgroundColor: "#F0F0F0" }}>
      <img
        src={imgSrc}
        alt={title}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        onError={(e) => {
          const el = e.target as HTMLImageElement;
          el.style.display = "none";
          if (el.parentElement) {
            el.parentElement.style.background = "linear-gradient(135deg, #1B3A5C 0%, #2d5a8e 100%)";
          }
        }}
      />
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
        <div style={{ position: "relative", flexShrink: 0 }}>
          <PhotoArea
            thumbnailUrl={place.thumbnailUrl}
            title={place.title}
            height={200}
            destinationCity={place.destinationCity}
            destinationCountry={place.destinationCountry}
            categoryTags={place.categoryTags}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.4) 100%)" }} />
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

        <div style={{ overflowY: "auto", flex: 1, padding: "20px 20px 32px" }}>
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

          {place.avgRating != null && (
            <div style={{ marginBottom: "14px" }}>
              <StarRow rating={place.avgRating} size={14} />
              <p style={{ fontSize: "11px", color: "#AAAAAA", margin: "3px 0 0" }}>Community average</p>
            </div>
          )}

          {place.saveCount >= 2 && (
            <p style={{ fontSize: "12px", color: "#717171", marginBottom: "14px" }}>
              Saved by <strong style={{ color: "#1B3A5C" }}>{place.saveCount} families</strong>
            </p>
          )}

          {place.description && (
            <p style={{ fontSize: "14px", color: "#444", lineHeight: 1.6, marginBottom: "20px" }}>
              {place.description}
            </p>
          )}

          {place.tips.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
                What families say
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {place.tips.map((tip) => (
                  <div
                    key={tip.id}
                    style={{ backgroundColor: "#F9F9F9", borderRadius: "10px", padding: "12px 14px", border: "1px solid #F0F0F0" }}
                  >
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#C4664A", backgroundColor: "rgba(196,102,74,0.1)", borderRadius: "20px", padding: "2px 8px", display: "inline-block", marginBottom: "6px" }}>
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
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "#F9F9F9", borderRadius: "10px", border: "1px solid #F0F0F0", textDecoration: "none" }}
                  >
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#1B3A5C" }}>{trip.title}</span>
                    <ChevronRight size={14} style={{ color: "#AAAAAA" }} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {place.websiteUrl && (
            <div style={{ marginBottom: "20px" }}>
              <a
                href={place.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "#1B3A5C", fontWeight: 500, textDecoration: "none" }}
              >
                <ExternalLink size={13} />
                Visit website
              </a>
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
            <button
              onClick={() => { onClose(); onAddToTrip(place); }}
              style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "1.5px solid #C4664A", backgroundColor: "transparent", color: "#C4664A", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              + Add to Trip
            </button>
            {bookingUrl && (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1, padding: "12px", borderRadius: "12px", backgroundColor: "#C4664A", color: "#fff", fontSize: "14px", fontWeight: 700, textDecoration: "none", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}
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

function AddToTripModal({ place, onClose }: { place: PlaceItem; onClose: () => void }) {
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
  const matchingTrips = trips.filter((t) => (t.destinationCity ?? "").toLowerCase() === cityLower && cityLower !== "");
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
        setSuccessMsg(tripId ? { text: `Added to ${tripName ?? "your trip"}`, tripId } : { text: "Saved to your Saves tab" });
        setTimeout(() => { setSuccessMsg(null); onClose(); }, 2000);
      }
    } catch { /* silently fail */ } finally {
      setAdding(null);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 600, backgroundColor: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: "400px", backgroundColor: "#fff", borderRadius: "20px", padding: "24px", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#1a1a1a", margin: 0 }}>Add to trip</h3>
            <p style={{ fontSize: "13px", color: "#717171", margin: "3px 0 0" }}>{place.title}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", padding: "0 0 0 12px", fontSize: "20px", lineHeight: 1 }}>×</button>
        </div>

        {successMsg && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#1B3A5C", marginBottom: "6px" }}>Done!</p>
            {successMsg.tripId ? (
              <Link href={`/trips/${successMsg.tripId}`} style={{ fontSize: "13px", color: "#C4664A", textDecoration: "none" }}>{successMsg.text} →</Link>
            ) : (
              <p style={{ fontSize: "13px", color: "#717171" }}>{successMsg.text}</p>
            )}
          </div>
        )}

        {!successMsg && !isSignedIn && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <p style={{ fontSize: "14px", color: "#717171", marginBottom: "16px" }}>Sign in to save places to your trips</p>
            <Link href="/sign-in" style={{ display: "inline-block", padding: "10px 24px", backgroundColor: "#1B3A5C", color: "#fff", fontSize: "14px", fontWeight: 700, borderRadius: "12px", textDecoration: "none" }}>Sign in</Link>
          </div>
        )}

        {!successMsg && isSignedIn && isLoading && (
          <p style={{ fontSize: "14px", color: "#AAAAAA", textAlign: "center", padding: "16px 0" }}>Loading your trips…</p>
        )}

        {!successMsg && isSignedIn && !isLoading && (
          <div>
            {displayTrips.length === 0 ? (
              <p style={{ fontSize: "14px", color: "#717171", marginBottom: "16px", textAlign: "center" }}>No active trips. Save for later?</p>
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
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", backgroundColor: "#F9F9F9", borderRadius: "12px", border: "1px solid #EEEEEE", cursor: "pointer", opacity: adding && adding !== trip.id ? 0.4 : 1, fontFamily: "inherit", textAlign: "left", transition: "opacity 0.15s" }}
                    >
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", margin: 0 }}>{trip.title}</p>
                        {trip.destinationCity && <p style={{ fontSize: "11px", color: "#717171", margin: "2px 0 0" }}>{trip.destinationCity}</p>}
                      </div>
                      <span style={{ fontSize: "12px", color: "#C4664A", fontWeight: 600, whiteSpace: "nowrap", marginLeft: "8px" }}>
                        {adding === trip.id ? "Adding…" : "Add →"}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              onClick={() => addToTrip(null)}
              disabled={adding !== null}
              style={{ width: "100%", padding: "11px", borderRadius: "12px", border: "1.5px solid #EEEEEE", backgroundColor: "transparent", color: "#717171", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: adding === "unorganized" ? 0.4 : 1 }}
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

function PlaceCard({ place, onDetails, onAddToTrip }: { place: PlaceItem; onDetails: (p: PlaceItem) => void; onAddToTrip: (p: PlaceItem) => void }) {
  const primaryTag = place.categoryTags[0] ?? null;
  const location = [place.destinationCity, place.destinationCountry].filter(Boolean).join(", ");

  return (
    <div
      className="hover:shadow-md transition-shadow duration-200"
      style={{ backgroundColor: "#fff", borderRadius: "16px", overflow: "hidden", border: "1px solid #EEEEEE", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column" }}
    >
      <div style={{ position: "relative", overflow: "hidden" }}>
        <PhotoArea
          thumbnailUrl={place.thumbnailUrl}
          title={place.title}
          height={160}
          destinationCity={place.destinationCity}
          destinationCountry={place.destinationCountry}
          categoryTags={place.categoryTags}
        />
        {primaryTag && (
          <div style={{ position: "absolute", top: "8px", left: "8px", zIndex: 1 }}>
            <CategoryPill tag={primaryTag} />
          </div>
        )}
      </div>

      <div style={{ padding: "12px 14px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
        <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 4px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
            style={{ flex: 1, padding: "8px 6px", borderRadius: "10px", border: "1.5px solid #C4664A", backgroundColor: "transparent", color: "#C4664A", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            + Add to Trip
          </button>
          <button
            onClick={() => onDetails(place)}
            style={{ flex: 1, padding: "8px 6px", borderRadius: "10px", border: "1.5px solid #E0E0E0", backgroundColor: "transparent", color: "#1B3A5C", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Details →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────────

export function TravelIntelSection({ submitOpen, onSubmitClose }: { submitOpen?: boolean; onSubmitClose?: () => void } = {}) {
  const [city,             setCity]            = useState("");
  const [suggestions,     setSuggestions]     = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions]  = useState(false);
  const [appliedCity,     setAppliedCity]     = useState("");
  const [category,        setCategory]        = useState("All");
  const [places,          setPlaces]          = useState<PlaceItem[]>([]);
  const [isLoading,       setIsLoading]       = useState(true);
  const [displayCount,    setDisplayCount]    = useState(6);
  const [selectedPlace,   setSelectedPlace]   = useState<PlaceItem | null>(null);
  const [addToTripPlace,  setAddToTripPlace]  = useState<PlaceItem | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Submit modal state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitUrl,        setSubmitUrl]       = useState("");
  const [submitType,       setSubmitType]      = useState("Article");
  const [submitDest,       setSubmitDest]      = useState("");
  const [submitDestSuggs,  setSubmitDestSuggs] = useState<string[]>([]);
  const [submitAgeGroups,  setSubmitAgeGroups] = useState<string[]>(["All ages"]);
  const [submitNote,       setSubmitNote]      = useState("");
  const [submitLoading,    setSubmitLoading]   = useState(false);
  const [submitDone,       setSubmitDone]      = useState(false);
  const [submitError,      setSubmitError]     = useState("");

  // City autocomplete
  useEffect(() => {
    if (city.length < 2) { setSuggestions([]); return; }
    const q = city.toLowerCase();
    setSuggestions(KNOWN_CITIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 6));
  }, [city]);

  // Sync external submit open trigger
  useEffect(() => { if (submitOpen) setShowSubmitModal(true); }, [submitOpen]);
  function closeSubmit() { closeSubmit(); onSubmitClose?.(); }

  // Submit modal destination autocomplete
  useEffect(() => {
    if (submitDest.length < 2) { setSubmitDestSuggs([]); return; }
    const q = submitDest.toLowerCase();
    setSubmitDestSuggs(KNOWN_CITIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 5));
  }, [submitDest]);

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
  const fetchPlaces = useCallback(async (cityParam: string, catParam: string) => {
    setIsLoading(true);
    setDisplayCount(6);
    const params = new URLSearchParams();
    if (cityParam) params.set("city", cityParam);
    if (catParam && catParam !== "All") params.set("category", catParam.toLowerCase());
    try {
      const res  = await fetch(`/api/travel-intel?${params.toString()}`);
      const data = await res.json() as { places: PlaceItem[]; total: number };
      setPlaces(data.places ?? []);
    } catch {
      setPlaces([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaces(appliedCity, category);
  }, [appliedCity, category, fetchPlaces]);

  function applyCity(val: string) {
    setCity(val);
    setAppliedCity(val);
    setShowSuggestions(false);
  }

  function clearCity() {
    setCity("");
    setAppliedCity("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  // Filter invalid place cards
  const filteredPlaces = places.filter((p) =>
    p.destinationCity &&
    !p.title.startsWith("Family of") &&
    !p.title.includes("· Kid")
  );

  const visiblePlaces  = filteredPlaces.slice(0, displayCount);
  const canLoadMore    = displayCount < filteredPlaces.length;

  return (
    <div>
      {/* Section header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "6px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", margin: 0 }}>
            COMMUNITY ACTIVITY EXPLORER
          </p>
          <button
            onClick={() => { setShowSubmitModal(true); setSubmitDone(false); setSubmitError(""); setSubmitUrl(""); setSubmitType("Article"); setSubmitDest(""); setSubmitAgeGroups(["All ages"]); setSubmitNote(""); }}
            style={{ fontSize: "13px", fontWeight: 700, color: "#C4664A", backgroundColor: "transparent", border: "1.5px solid #C4664A", borderRadius: "8px", padding: "6px 14px", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}
          >
            Submit content →
          </button>
        </div>
        <h2 className={playfair.className} style={{ fontSize: "26px", fontWeight: 900, color: "#1B3A5C", margin: "0 0 8px", lineHeight: 1.2 }}>
          Community Picks
        </h2>
        <p style={{ fontSize: "14px", color: "#717171", margin: 0 }}>
          Places and activities saved by families who&apos;ve been there — searchable by destination.
        </p>
      </div>

      {/* City search */}
      <div ref={searchRef} style={{ position: "relative", marginBottom: "14px" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Search size={15} style={{ position: "absolute", left: "14px", color: "#AAAAAA", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search a city or country..."
            value={city}
            onChange={(e) => { setCity(e.target.value); setShowSuggestions(true); if (!e.target.value) clearCity(); }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyCity(city);
              if (e.key === "Escape") clearCity();
            }}
            style={{ width: "100%", padding: "11px 44px", borderRadius: "999px", border: "1.5px solid #E5E5E5", fontSize: "14px", color: "#1a1a1a", backgroundColor: "#F9F9F9", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          />
          {city && (
            <button onClick={clearCity} style={{ position: "absolute", right: "14px", background: "none", border: "none", cursor: "pointer", color: "#AAAAAA", padding: "2px", display: "flex" }}>
              <X size={14} />
            </button>
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, backgroundColor: "#fff", border: "1.5px solid #E5E5E5", borderRadius: "14px", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", zIndex: 100, overflow: "hidden" }}>
            {suggestions.map((c) => (
              <button
                key={c}
                onMouseDown={() => applyCity(c)}
                style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: "14px", color: "#1a1a1a", fontFamily: "inherit" }}
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
        style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "24px", scrollbarWidth: "none", msOverflowStyle: "none" }}
        className="hide-scrollbar"
      >
        {INTEL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{ flexShrink: 0, padding: "7px 16px", borderRadius: "999px", border: category === cat ? "none" : "1.5px solid #E0E0E0", backgroundColor: category === cat ? "#C4664A" : "#fff", color: category === cat ? "#fff" : "#717171", fontSize: "13px", fontWeight: category === cat ? 700 : 500, cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit" }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid or states */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: "24px" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ borderRadius: "16px", backgroundColor: "#F5F5F5", height: "280px" }} />
          ))}
        </div>
      ) : filteredPlaces.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", backgroundColor: "#F9F9F9", borderRadius: "16px", border: "1px solid #EEEEEE" }}>
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#1a1a1a", marginBottom: "6px" }}>
            {appliedCity ? `No places found for ${appliedCity}` : "No places yet"}
          </p>
          <p style={{ fontSize: "13px", color: "#717171", marginBottom: "16px" }}>
            {appliedCity ? "Be the first to add a trip here." : "Places will appear as families share their completed trips."}
          </p>
          <Link href="/trips/past/new" style={{ display: "inline-block", padding: "10px 24px", backgroundColor: "#C4664A", color: "#fff", fontSize: "13px", fontWeight: 700, borderRadius: "999px", textDecoration: "none" }}>
            Add a past trip →
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: "24px" }}>
            {visiblePlaces.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                onDetails={setSelectedPlace}
                onAddToTrip={setAddToTripPlace}
              />
            ))}
          </div>

          {canLoadMore && (
            <div style={{ textAlign: "center", marginTop: "32px" }}>
              <button
                onClick={() => setDisplayCount((c) => c + 6)}
                style={{ padding: "12px 32px", borderRadius: "999px", border: "2px solid #C4664A", backgroundColor: "transparent", color: "#C4664A", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Load more places →
              </button>
            </div>
          )}
        </>
      )}

      {selectedPlace && (
        <DetailsSheet
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
          onAddToTrip={(p) => { setSelectedPlace(null); setAddToTripPlace(p); }}
        />
      )}

      {addToTripPlace && (
        <AddToTripModal place={addToTripPlace} onClose={() => setAddToTripPlace(null)} />
      )}

      {/* Content submission modal */}
      {showSubmitModal && createPortal(
        <div
          onClick={() => closeSubmit()}
          style={{ position: "fixed", inset: 0, zIndex: 600, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "20px", width: "100%", maxWidth: "480px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 0" }}>
              <p style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", margin: 0 }}>Submit content</p>
              <button onClick={() => closeSubmit()} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", padding: "4px", lineHeight: 1 }}>
                <X size={20} />
              </button>
            </div>

            {submitDone ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>✓</div>
                <p style={{ fontSize: "17px", fontWeight: 700, color: "#1B3A5C", marginBottom: "6px" }}>Thanks for sharing!</p>
                <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5 }}>We&apos;ll review and publish within 48 hours.</p>
                <button
                  onClick={() => closeSubmit()}
                  style={{ marginTop: "20px", padding: "11px 28px", borderRadius: "12px", border: "none", backgroundColor: "#1B3A5C", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Done
                </button>
              </div>
            ) : (
              <div style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                  {/* URL */}
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>URL *</label>
                    <input
                      type="url"
                      value={submitUrl}
                      onChange={e => setSubmitUrl(e.target.value)}
                      placeholder="Paste a link to an article, video or guide..."
                      style={{ width: "100%", border: "1.5px solid #E8E8E8", borderRadius: "12px", padding: "11px 14px", fontSize: "14px", color: "#1a1a1a", outline: "none", fontFamily: "inherit", boxSizing: "border-box", backgroundColor: "#fff" }}
                    />
                  </div>

                  {/* Content type */}
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>Content type *</label>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {["Article", "Video", "Guide", "Other"].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSubmitType(t)}
                          style={{ padding: "7px 16px", borderRadius: "999px", border: "1.5px solid", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", borderColor: submitType === t ? "#C4664A" : "#E8E8E8", backgroundColor: submitType === t ? "#C4664A" : "#fff", color: submitType === t ? "#fff" : "#717171" }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Destination */}
                  <div style={{ position: "relative" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Destination *</label>
                    <input
                      type="text"
                      value={submitDest}
                      onChange={e => setSubmitDest(e.target.value)}
                      placeholder="e.g. Seoul, Japan, Kyoto..."
                      style={{ width: "100%", border: "1.5px solid #E8E8E8", borderRadius: "12px", padding: "11px 14px", fontSize: "14px", color: "#1a1a1a", outline: "none", fontFamily: "inherit", boxSizing: "border-box", backgroundColor: "#fff" }}
                    />
                    {submitDestSuggs.length > 0 && submitDest && (
                      <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, backgroundColor: "#fff", border: "1.5px solid #E8E8E8", borderRadius: "12px", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", zIndex: 10, overflow: "hidden" }}>
                        {submitDestSuggs.map(c => (
                          <button
                            key={c}
                            type="button"
                            onMouseDown={() => { setSubmitDest(c); setSubmitDestSuggs([]); }}
                            style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: "14px", color: "#1a1a1a", fontFamily: "inherit" }}
                          >
                            <MapPin size={12} style={{ color: "#C4664A", flexShrink: 0 }} />
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Age group */}
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>Age group relevance</label>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {["All ages", "Under 5", "5–8", "8–12", "Teens"].map(ag => {
                        const active = submitAgeGroups.includes(ag);
                        return (
                          <button
                            key={ag}
                            type="button"
                            onClick={() => {
                              if (ag === "All ages") {
                                setSubmitAgeGroups(["All ages"]);
                              } else {
                                setSubmitAgeGroups(prev => {
                                  const without = prev.filter(x => x !== "All ages");
                                  return active ? without.filter(x => x !== ag) || ["All ages"] : [...without, ag];
                                });
                              }
                            }}
                            style={{ padding: "6px 14px", borderRadius: "999px", border: "1.5px solid", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", borderColor: active ? "#1B3A5C" : "#E8E8E8", backgroundColor: active ? "#1B3A5C" : "#fff", color: active ? "#fff" : "#717171" }}
                          >
                            {ag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Why useful */}
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Why is this useful? <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
                    <textarea
                      value={submitNote}
                      onChange={e => setSubmitNote(e.target.value)}
                      placeholder="What makes this worth reading for families?"
                      rows={3}
                      style={{ width: "100%", border: "1.5px solid #E8E8E8", borderRadius: "12px", padding: "11px 14px", fontSize: "14px", color: "#1a1a1a", outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "none", backgroundColor: "#fff" }}
                    />
                  </div>

                  {submitError && (
                    <p style={{ fontSize: "13px", color: "#C4664A", fontWeight: 600 }}>{submitError}</p>
                  )}

                  {/* Submit */}
                  <button
                    type="button"
                    disabled={!submitUrl.trim() || !submitDest.trim() || submitLoading}
                    onClick={async () => {
                      if (!submitUrl.trim() || !submitDest.trim()) {
                        setSubmitError("URL and destination are required.");
                        return;
                      }
                      setSubmitLoading(true);
                      setSubmitError("");
                      try {
                        const ageGroup = submitAgeGroups.includes("All ages") ? "all" : submitAgeGroups.join(",");
                        const res = await fetch("/api/content/submit", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            url: submitUrl.trim(),
                            contentType: submitType.toLowerCase(),
                            destination: submitDest.trim(),
                            ageGroup,
                            description: submitNote.trim() || null,
                          }),
                        });
                        if (!res.ok) {
                          const d = await res.json() as { error?: string };
                          setSubmitError(d.error ?? "Failed to submit. Please try again.");
                          return;
                        }
                        setSubmitDone(true);
                      } catch {
                        setSubmitError("Network error. Please try again.");
                      } finally {
                        setSubmitLoading(false);
                      }
                    }}
                    style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "none", backgroundColor: (!submitUrl.trim() || !submitDest.trim() || submitLoading) ? "#E0E0E0" : "#C4664A", color: (!submitUrl.trim() || !submitDest.trim() || submitLoading) ? "#aaa" : "#fff", fontSize: "15px", fontWeight: 700, cursor: (!submitUrl.trim() || !submitDest.trim() || submitLoading) ? "default" : "pointer", fontFamily: "inherit" }}
                  >
                    {submitLoading ? "Submitting..." : "Submit for review"}
                  </button>

                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
