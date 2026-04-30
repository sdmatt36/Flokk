"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Clock, Footprints, MapPin } from "lucide-react";
import type { ResolvedShareEntity } from "@/lib/share-token";

const NAVY = "#1B3A5C";
const TERRA = "#C4664A";
const GRAY = "#6B7280";

interface Props {
  token: string;
  entity: ResolvedShareEntity;
  isSignedIn: boolean;
}

const INTENT_KEY = "flokk_share_intent";
const INTENT_TTL_MS = 10 * 60 * 1000; // 10 min

export function ShareItemView({ token, entity, isSignedIn }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function storeIntent() {
    try {
      localStorage.setItem(
        INTENT_KEY,
        JSON.stringify({ token, entityType: entity.entityType, ts: Date.now() })
      );
    } catch {
      // localStorage unavailable — proceed anyway
    }
  }

  async function handleSave() {
    if (!isSignedIn) {
      storeIntent();
      router.push("/sign-up");
      return;
    }
    if (saving || saved) return;
    setSaving(true);
    setError(null);
    try {
      let res: Response;
      if (entity.entityType === "generated_tour") {
        res = await fetch("/api/tours/save-from-share-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
      } else {
        res = await fetch("/api/saves/from-share-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Save failed");
        return;
      }
      setSaved(true);
    } catch {
      setError("Something went wrong — please try again");
    } finally {
      setSaving(false);
    }
  }

  const ctaLabel = saved
    ? "Saved to your Flokk"
    : saving
    ? "Saving..."
    : isSignedIn
    ? "Save to my Flokk"
    : "Sign up to save this";

  return (
    <div style={{ minHeight: "100svh", background: "#FAFAFA", fontFamily: "Inter, sans-serif" }}>
      {/* Brand bar */}
      <div style={{ background: NAVY, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "Playfair Display, serif", fontSize: "20px", fontWeight: 700, color: "white", letterSpacing: "-0.02em" }}>
          Flokk
        </span>
        {!isSignedIn && (
          <a
            href="/sign-in"
            style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", textDecoration: "none" }}
          >
            Sign in
          </a>
        )}
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 80px 0" }}>
        {entity.entityType === "saved_item" && entity.savedItem && (
          <SavedItemLayout item={entity.savedItem} />
        )}
        {entity.entityType === "itinerary_item" && entity.itineraryItem && (
          entity.itineraryItem.type === "FLIGHT" ? <FlightLayout item={entity.itineraryItem} /> :
          entity.itineraryItem.type === "TRAIN" ? <TrainLayout item={entity.itineraryItem} /> :
          <ItineraryItemLayout item={entity.itineraryItem} />
        )}
        {entity.entityType === "manual_activity" && entity.manualActivity && (
          <ManualActivityLayout item={entity.manualActivity} />
        )}
        {entity.entityType === "generated_tour" && entity.generatedTour && (
          <TourLayout tour={entity.generatedTour} />
        )}

        {/* CTA */}
        {entity.entityType !== "itinerary_item" || canSaveItineraryItem(entity) ? (
          <div style={{ padding: "16px 16px 0" }}>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 12,
                border: "none",
                background: saved ? "#4a7c59" : TERRA,
                color: "white",
                fontSize: "15px",
                fontWeight: 600,
                cursor: saving || saved ? "default" : "pointer",
                opacity: saving ? 0.7 : 1,
                fontFamily: "inherit",
              }}
            >
              {ctaLabel}
            </button>
            {error && (
              <p style={{ fontSize: "13px", color: "#e53e3e", marginTop: 8, textAlign: "center" }}>{error}</p>
            )}
            {!isSignedIn && (
              <p style={{ fontSize: "12px", color: GRAY, marginTop: 8, textAlign: "center" }}>
                Free to join — takes 30 seconds.
              </p>
            )}
          </div>
        ) : null}
        {entity.entityType === "itinerary_item" && entity.itineraryItem?.trip?.title && (
          <p style={{ textAlign: "center", fontSize: "12px", color: GRAY, marginTop: 24, paddingBottom: 16 }}>
            From {entity.itineraryItem.trip.title}
            <span style={{ margin: "0 8px", color: "#D1D5DB" }}>·</span>
            Shared on Flokk
          </p>
        )}
        {entity.entityType === "saved_item" && (
          <p style={{ textAlign: "center", fontSize: "12px", color: GRAY, marginTop: 24, paddingBottom: 16 }}>
            {entity.savedItem?.trip?.title ? (
              <>
                From {entity.savedItem.trip.title}
                <span style={{ margin: "0 8px", color: "#D1D5DB" }}>·</span>
              </>
            ) : null}
            Shared on Flokk
          </p>
        )}
        {entity.entityType === "manual_activity" && (
          <p style={{ textAlign: "center", fontSize: "12px", color: GRAY, marginTop: 24, paddingBottom: 16 }}>
            {entity.manualActivity?.trip?.title ? (
              <>
                From {entity.manualActivity.trip.title}
                <span style={{ margin: "0 8px", color: "#D1D5DB" }}>·</span>
              </>
            ) : null}
            Shared on Flokk
          </p>
        )}
      </div>
    </div>
  );
}

function canSaveItineraryItem(entity: ResolvedShareEntity): boolean {
  // FLIGHT/TRAIN shares are informational — no save CTA
  if (!entity.itineraryItem) return false;
  return entity.itineraryItem.type !== "FLIGHT" && entity.itineraryItem.type !== "TRAIN";
}

// ─── SavedItem layout ────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  google_maps: "Google Maps",
  direct: "email",
};

function SavedItemLayout({ item }: { item: NonNullable<ResolvedShareEntity["savedItem"]> }) {
  const primaryTag = (item.categoryTags[0] ?? "").toLowerCase();
  const typeLabel =
    primaryTag.includes("lodging") ? "LODGING" :
    primaryTag.includes("food") ? "FOOD" :
    (primaryTag.includes("activity") || primaryTag.includes("experience")) ? "ACTIVITY" :
    "SAVED";

  const displayTitle = item.rawTitle ?? "Place";

  const locationLine = item.destinationCity
    ? [item.destinationCity, item.destinationCountry].filter(Boolean).join(", ")
    : null;

  const platformDisplay = item.sourcePlatform
    ? (PLATFORM_LABELS[item.sourcePlatform] ?? (item.sourcePlatform.charAt(0).toUpperCase() + item.sourcePlatform.slice(1)))
    : null;
  const savedAtFormatted = new Date(item.savedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dateLine = platformDisplay
    ? `Saved from ${platformDisplay} · ${savedAtFormatted}`
    : `Saved ${savedAtFormatted}`;

  const cityCountry = [item.destinationCity, item.destinationCountry].filter(Boolean).join(", ");
  const synthesizedDescription =
    typeLabel === "LODGING" ? (cityCountry ? `Lodging in ${cityCountry}` : "A place worth visiting") :
    typeLabel === "FOOD"    ? (cityCountry ? `Restaurant in ${cityCountry}` : "A place worth visiting") :
    typeLabel === "ACTIVITY"? (cityCountry ? `Experience in ${cityCountry}` : "A place worth visiting") :
    (cityCountry ? `Saved place in ${cityCountry}` : "A place worth visiting");
  const displayDescription = item.rawDescription ?? item.userNote ?? synthesizedDescription;

  const heroPhoto = item.placePhotoUrl ?? item.mediaThumbnailUrl ?? null;
  const visitUrl = item.websiteUrl ?? item.sourceUrl ?? null;

  return (
    <div>
      {heroPhoto && (
        <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", background: "#E5E7EB" }}>
          <img src={heroPhoto} alt={displayTitle} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div style={{ padding: "20px 16px 0" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: TERRA, textTransform: "uppercase", letterSpacing: "0.06em" }}>{typeLabel}</span>
        <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: "22px", fontWeight: 700, color: NAVY, margin: "4px 0 4px" }}>
          {displayTitle}
        </h1>
        {locationLine && (
          <p style={{ fontSize: "14px", color: GRAY, marginBottom: 8 }}>{locationLine}</p>
        )}
        <p style={{ fontSize: "13px", color: GRAY, marginBottom: 6 }}>{dateLine}</p>
        {displayDescription && (
          <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6, marginBottom: 12 }}>{displayDescription}</p>
        )}
        {item.userRating != null && item.userRating > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
            <span style={{ fontSize: "12px", color: GRAY }}>Rated:</span>
            <div style={{ display: "flex", gap: 2 }}>
              {[1,2,3,4,5].map(i => (
                <span key={i} style={{ color: i <= item.userRating! ? "#C4664A" : "#d1d5db", fontSize: 14 }}>★</span>
              ))}
            </div>
          </div>
        )}
        {visitUrl && (
          <a href={visitUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: TERRA, textDecoration: "none", display: "block", marginBottom: 8 }}>
            Visit website
          </a>
        )}
      </div>
    </div>
  );
}

// ─── ItineraryItem layout ────────────────────────────────────────────────────

function ItineraryItemLayout({ item }: { item: NonNullable<ResolvedShareEntity["itineraryItem"]> }) {
  const ps = item.parallelSavedItem;
  const isTransit = item.type === "FLIGHT" || item.type === "TRAIN";
  const isLodging = item.type === "LODGING";

  const strippedItemTitle = item.title?.replace(/^(check-in|check-out):\s*/i, "") ?? item.title;
  const title = isTransit
    ? (item.type === "FLIGHT"
      ? `${item.fromAirport ?? item.fromCity ?? ""} → ${item.toAirport ?? item.toCity ?? ""}`
      : `${item.fromCity ?? ""} → ${item.toCity ?? ""}`)
    : (ps?.rawTitle ?? strippedItemTitle);

  const typeLabel = item.type === "FLIGHT" ? "Flight" : item.type === "TRAIN" ? "Train" : isLodging ? "Lodging" : "Activity";

  const visitUrl = ps?.websiteUrl ?? item.venueUrl ?? null;

  const locationLine = ps?.destinationCity
    ? [ps.destinationCity, ps.destinationCountry].filter(Boolean).join(", ")
    : null;

  const formattedDate = item.scheduledDate
    ? new Date(item.scheduledDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const checkPrefix = isLodging && item.title
    ? /^check-?out/i.test(item.title) ? "Check-out" : "Check-in"
    : null;

  const synthesizedDescription = isLodging && !ps?.rawDescription && ps?.destinationCity
    ? `Lodging in ${ps.destinationCity}${ps.destinationCountry ? `, ${ps.destinationCountry}` : ""}`
    : null;
  const displayDescription = ps?.rawDescription ?? synthesizedDescription;

  return (
    <div>
      {ps?.placePhotoUrl && (
        <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", background: "#E5E7EB" }}>
          <img src={ps.placePhotoUrl} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div style={{ padding: "20px 16px 0" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: TERRA, textTransform: "uppercase", letterSpacing: "0.06em" }}>{typeLabel}</span>
        <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: "22px", fontWeight: 700, color: NAVY, margin: "4px 0 4px" }}>
          {title}
        </h1>
        {locationLine && (
          <p style={{ fontSize: "14px", color: GRAY, marginBottom: 8 }}>{locationLine}</p>
        )}
        {item.scheduledDate && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 6 }}>
            {isLodging && checkPrefix
              ? `${checkPrefix} · ${formattedDate}`
              : isTransit
                ? `${item.scheduledDate}${item.departureTime ? ` · ${item.departureTime}` : ""}${item.arrivalTime ? ` – ${item.arrivalTime}` : ""}`
                : formattedDate}
          </p>
        )}
        {item.address && !isTransit && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 6 }}>{item.address}</p>
        )}
        {displayDescription && (
          <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6, marginBottom: 12 }}>{displayDescription}</p>
        )}
        {item.notes && (
          <p style={{ fontSize: "13px", color: GRAY, lineHeight: 1.5, marginBottom: 12 }}>{item.notes}</p>
        )}
        {ps?.userRating != null && ps.userRating > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
            <span style={{ fontSize: "12px", color: GRAY }}>Rated:</span>
            <div style={{ display: "flex", gap: 2 }}>
              {[1,2,3,4,5].map(i => (
                <span key={i} style={{ color: i <= (ps?.userRating ?? 0) ? "#C4664A" : "#d1d5db", fontSize: 14 }}>★</span>
              ))}
            </div>
          </div>
        )}
        {visitUrl && (
          <a href={visitUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: TERRA, textDecoration: "none", display: "block", marginBottom: 8 }}>
            Visit website
          </a>
        )}
      </div>
    </div>
  );
}

// ─── ManualActivity layout ───────────────────────────────────────────────────

function ManualActivityLayout({ item }: { item: NonNullable<ResolvedShareEntity["manualActivity"]> }) {
  const typeLabel = item.type ?? "ACTIVITY";

  const formattedDate = item.date
    ? new Date(item.date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // ManualActivity has city but no country column
  const locationLine = item.city ?? null;

  // notes is the description equivalent on ManualActivity (no description column)
  const synthesizedDescription = item.city ? `Activity in ${item.city}` : "An experience worth having";
  const displayDescription = item.notes ?? synthesizedDescription;

  const visitUrl = item.website ?? null;

  return (
    <div>
      {item.imageUrl && (
        <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", background: "#E5E7EB" }}>
          <img src={item.imageUrl} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div style={{ padding: "20px 16px 0" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: TERRA, textTransform: "uppercase", letterSpacing: "0.06em" }}>{typeLabel}</span>
        <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: "22px", fontWeight: 700, color: NAVY, margin: "4px 0 4px" }}>
          {item.title}
        </h1>
        {locationLine && (
          <p style={{ fontSize: "14px", color: GRAY, marginBottom: 8 }}>{locationLine}</p>
        )}
        {formattedDate && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 6 }}>
            {formattedDate}{item.time ? ` · ${item.time}` : ""}{item.endTime ? ` – ${item.endTime}` : ""}
          </p>
        )}
        {item.venueName && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 6 }}>{item.venueName}</p>
        )}
        {item.address && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 6 }}>{item.address}</p>
        )}
        {displayDescription && (
          <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6, marginBottom: 12 }}>{displayDescription}</p>
        )}
        {item.price != null && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 6 }}>{item.currency ? `${item.currency} ` : ""}{item.price.toLocaleString()}</p>
        )}
        {visitUrl && (
          <a href={visitUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: TERRA, textDecoration: "none", display: "block", marginBottom: 8 }}>
            Visit website
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Flight layout ───────────────────────────────────────────────────────────

function FlightLayout({ item }: { item: NonNullable<ResolvedShareEntity["itineraryItem"]> }) {
  const route = [
    item.fromAirport ?? item.fromCity ?? null,
    item.toAirport ?? item.toCity ?? null,
  ].filter(Boolean).join(" → ");

  const formattedDate = item.scheduledDate
    ? new Date(item.scheduledDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const timeLine = item.departureTime || item.arrivalTime
    ? [item.departureTime, item.arrivalTime].filter(Boolean).join(" – ")
    : null;

  return (
    <div>
      <div style={{ padding: "20px 16px 0" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: TERRA, textTransform: "uppercase", letterSpacing: "0.06em" }}>FLIGHT</span>
        <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: "22px", fontWeight: 700, color: NAVY, margin: "4px 0 4px" }}>
          {route || item.title}
        </h1>
        {formattedDate && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 6 }}>{formattedDate}</p>
        )}
        {timeLine && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 6 }}>{timeLine}</p>
        )}
        {item.confirmationCode && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 12 }}>Confirmation: {item.confirmationCode}</p>
        )}
        {item.notes && (
          <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6, marginBottom: 12 }}>{item.notes}</p>
        )}
      </div>
    </div>
  );
}

// ─── Train layout ────────────────────────────────────────────────────────────

function TrainLayout({ item }: { item: NonNullable<ResolvedShareEntity["itineraryItem"]> }) {
  const route = [
    item.fromCity ?? null,
    item.toCity ?? null,
  ].filter(Boolean).join(" → ");

  const formattedDate = item.scheduledDate
    ? new Date(item.scheduledDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const timeLine = item.departureTime || item.arrivalTime
    ? [item.departureTime, item.arrivalTime].filter(Boolean).join(" – ")
    : null;

  return (
    <div>
      <div style={{ padding: "20px 16px 0" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: TERRA, textTransform: "uppercase", letterSpacing: "0.06em" }}>TRAIN</span>
        <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: "22px", fontWeight: 700, color: NAVY, margin: "4px 0 4px" }}>
          {route || item.title}
        </h1>
        {formattedDate && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 6 }}>{formattedDate}</p>
        )}
        {timeLine && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 6 }}>{timeLine}</p>
        )}
        {item.confirmationCode && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 12 }}>Confirmation: {item.confirmationCode}</p>
        )}
        {item.notes && (
          <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6, marginBottom: 12 }}>{item.notes}</p>
        )}
      </div>
    </div>
  );
}

// ─── GeneratedTour layout ────────────────────────────────────────────────────

function TourLayout({ tour }: { tour: NonNullable<ResolvedShareEntity["generatedTour"]> }) {
  return (
    <div style={{ padding: "20px 16px 0" }}>
      <span style={{ fontSize: "11px", fontWeight: 700, color: TERRA, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tour</span>
      <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: "22px", fontWeight: 700, color: NAVY, margin: "4px 0 4px" }}>
        {tour.title}
      </h1>
      <p style={{ fontSize: "13px", color: GRAY, marginBottom: 4 }}>
        {tour.destinationCity}{tour.destinationCountry ? `, ${tour.destinationCountry}` : ""}
      </p>
      <p style={{ fontSize: "12px", color: GRAY, marginBottom: 16 }}>
        {tour.durationLabel} · {tour.transport}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {tour.stops.map((stop, idx) => (
          <div key={stop.id} style={{ display: "flex", alignItems: "flex-start", border: "1px solid #F3F4F6", borderRadius: "16px", overflow: "hidden", backgroundColor: "#fff" }}>
            {/* 96×96 image */}
            <div style={{ width: "96px", height: "96px", flexShrink: 0, backgroundColor: "#F3F4F6", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {stop.imageUrl ? (
                <img src={stop.imageUrl} alt={stop.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <MapPin size={20} style={{ color: "#D1D5DB" }} />
              )}
            </div>
            {/* Content */}
            <div style={{ flex: 1, minWidth: 0, padding: "10px 12px 10px 10px" }}>
              {/* Badge + title */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                <div style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: TERRA, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "10px", fontWeight: 700, flexShrink: 0, marginTop: "2px" }}>
                  {idx + 1}
                </div>
                <p style={{ fontSize: "14px", fontWeight: 600, color: NAVY, margin: 0, lineHeight: 1.3 }}>{stop.name}</p>
              </div>
              {/* Link */}
              {stop.websiteUrl && (
                <a href={stop.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "12px", color: TERRA, textDecoration: "none", marginTop: "4px" }}>
                  <ExternalLink size={12} />
                  Link
                </a>
              )}
              {/* Duration + walk + ticket pills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                {stop.durationMin && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", backgroundColor: "#F3F4F6", borderRadius: "999px", padding: "2px 8px", fontSize: "11px", color: "#6B7280" }}>
                    <Clock size={10} />
                    {stop.durationMin} min
                  </span>
                )}
                {tour.transport === "Walking" && idx > 0 && (stop.travelTimeMin ?? 0) > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", backgroundColor: "#F3F4F6", borderRadius: "999px", padding: "2px 8px", fontSize: "11px", color: "#6B7280" }}>
                    <Footprints size={10} />
                    {stop.travelTimeMin} min walk
                  </span>
                )}
                {stop.ticketRequired === "ticket-required" && (
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "#92400E", backgroundColor: "#FEF3C7", borderRadius: "999px", padding: "2px 8px" }}>Ticket required</span>
                )}
                {stop.ticketRequired === "advance-booking-recommended" && (
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "#92400E", backgroundColor: "#FEF3C7", borderRadius: "999px", padding: "2px 8px" }}>Book ahead</span>
                )}
                {stop.ticketRequired === "free" && (
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "#065F46", backgroundColor: "#D1FAE5", borderRadius: "999px", padding: "2px 8px" }}>Free</span>
                )}
              </div>
              {/* Why */}
              {stop.why && (
                <p style={{ fontSize: "12px", color: "#6B7280", margin: "4px 0 0", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {stop.why}
                </p>
              )}
              {/* familyNote */}
              {stop.familyNote && (
                <p style={{ fontSize: "12px", color: TERRA, fontStyle: "italic", margin: "2px 0 0", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {stop.familyNote}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
