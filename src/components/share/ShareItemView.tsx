"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TourResults from "@/components/TourResults";
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

function SavedItemLayout({ item }: { item: NonNullable<ResolvedShareEntity["savedItem"]> }) {
  const title = item.rawTitle ?? "Place";
  const city = [item.destinationCity, item.destinationCountry].filter(Boolean).join(", ");
  const link = item.websiteUrl ?? item.sourceUrl ?? null;

  return (
    <div>
      {item.placePhotoUrl && (
        <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", background: "#E5E7EB" }}>
          <img
            src={item.placePhotoUrl}
            alt={title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}
      <div style={{ padding: "20px 16px 0" }}>
        <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: "24px", fontWeight: 700, color: NAVY, marginBottom: 4 }}>
          {title}
        </h1>
        {city && (
          <p style={{ fontSize: "14px", color: GRAY, marginBottom: 12 }}>{city}</p>
        )}
        {item.rawDescription && (
          <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6, marginBottom: 12 }}>
            {item.rawDescription}
          </p>
        )}
        {item.categoryTags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {item.categoryTags.map(tag => (
              <span key={tag} style={{ fontSize: "11px", fontWeight: 600, color: TERRA, background: "rgba(196,102,74,0.08)", borderRadius: 999, padding: "3px 10px", textTransform: "capitalize" }}>
                {tag}
              </span>
            ))}
          </div>
        )}
        {item.userRating && item.userRating > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
            <span style={{ fontSize: "12px", color: GRAY }}>Rated:</span>
            <div style={{ display: "flex", gap: 2 }}>
              {[1,2,3,4,5].map(i => (
                <span key={i} style={{ color: i <= item.userRating! ? "#f59e0b" : "#d1d5db", fontSize: 14 }}>★</span>
              ))}
            </div>
          </div>
        )}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "13px", color: TERRA, textDecoration: "none", display: "block", marginBottom: 8 }}
          >
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
  const title = isTransit
    ? (item.type === "FLIGHT"
      ? `${item.fromAirport ?? item.fromCity ?? ""} → ${item.toAirport ?? item.toCity ?? ""}`
      : `${item.fromCity ?? ""} → ${item.toCity ?? ""}`)
    : (ps?.rawTitle ?? item.title);

  const typeLabel = item.type === "FLIGHT" ? "Flight" : item.type === "TRAIN" ? "Train" : item.type === "LODGING" ? "Lodging" : "Activity";

  return (
    <div>
      {ps?.placePhotoUrl && (
        <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", background: "#E5E7EB" }}>
          <img src={ps.placePhotoUrl} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div style={{ padding: "20px 16px 0" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: TERRA, textTransform: "uppercase", letterSpacing: "0.06em" }}>{typeLabel}</span>
        <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: "22px", fontWeight: 700, color: NAVY, margin: "4px 0 8px" }}>
          {title}
        </h1>
        {item.scheduledDate && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 6 }}>
            {item.scheduledDate}{item.departureTime ? ` · ${item.departureTime}` : ""}{item.arrivalTime ? ` – ${item.arrivalTime}` : ""}
          </p>
        )}
        {item.address && !isTransit && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 6 }}>{item.address}</p>
        )}
        {ps?.rawDescription && (
          <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6, marginBottom: 12 }}>{ps.rawDescription}</p>
        )}
        {item.notes && (
          <p style={{ fontSize: "13px", color: GRAY, lineHeight: 1.5, marginBottom: 12 }}>{item.notes}</p>
        )}
        {item.venueUrl && (
          <a href={item.venueUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: TERRA, textDecoration: "none" }}>
            Visit website
          </a>
        )}
      </div>
    </div>
  );
}

// ─── ManualActivity layout ───────────────────────────────────────────────────

function ManualActivityLayout({ item }: { item: NonNullable<ResolvedShareEntity["manualActivity"]> }) {
  const label = item.type ?? "Activity";
  return (
    <div>
      {item.imageUrl && (
        <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", background: "#E5E7EB" }}>
          <img src={item.imageUrl} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div style={{ padding: "20px 16px 0" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: TERRA, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
        <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: "22px", fontWeight: 700, color: NAVY, margin: "4px 0 8px" }}>
          {item.title}
        </h1>
        <p style={{ fontSize: "13px", color: GRAY, marginBottom: 4 }}>
          {item.date}{item.time ? ` · ${item.time}` : ""}{item.endTime ? ` – ${item.endTime}` : ""}
        </p>
        {item.venueName && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 4 }}>{item.venueName}</p>
        )}
        {item.address && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 12 }}>{item.address}</p>
        )}
        {item.notes && (
          <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6, marginBottom: 12 }}>{item.notes}</p>
        )}
        {item.price != null && (
          <p style={{ fontSize: "13px", color: GRAY, marginBottom: 8 }}>{item.currency ?? ""} {item.price.toLocaleString()}</p>
        )}
        {item.website && (
          <a href={item.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: TERRA, textDecoration: "none" }}>
            Visit website
          </a>
        )}
      </div>
    </div>
  );
}

// ─── GeneratedTour layout ────────────────────────────────────────────────────

function TourLayout({ tour }: { tour: NonNullable<ResolvedShareEntity["generatedTour"]> }) {
  // Map tour stops to TourResults Stop shape
  const stops = tour.stops.map(s => ({
    id: s.id,
    orderIndex: s.orderIndex,
    name: s.name,
    address: s.address ?? "",
    lat: s.lat ?? 0,
    lng: s.lng ?? 0,
    duration: s.durationMin ?? 60,
    travelTime: s.travelTimeMin ?? 0,
    why: s.why ?? "",
    familyNote: s.familyNote ?? "",
    imageUrl: s.imageUrl ?? null,
    websiteUrl: s.websiteUrl ?? null,
    ticketRequired: s.ticketRequired ?? null,
    placeTypes: s.placeTypes,
  }));

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
      <TourResults
        stops={stops}
        removedStops={[]}
        destinationCity={tour.destinationCity}
        destinationCountry={tour.destinationCountry}
        prompt={tour.prompt}
        durationLabel={tour.durationLabel}
        transport={tour.transport}
        tourId={null}
        walkViolations={0}
        originalTargetStops={stops.length}
        onRemoveStop={() => {}}
        onQuickUndo={() => {}}
        onDeleteCommit={() => {}}
        onPermanentRestore={() => {}}
        onReplaceStops={() => {}}
        readOnly={true}
      />
    </div>
  );
}
