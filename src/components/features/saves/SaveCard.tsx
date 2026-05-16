"use client";

import { useState } from "react";
import { MapPin, Trash2, Bookmark } from "lucide-react";
import { getItemImage } from "@/lib/destination-images";
import { categoryLabel } from "@/lib/categories";
import { CategoryBadges } from "@/components/shared/CategoryBadges";
import { Pill } from "@/components/ui/Pill";
import { PlaceActionRow } from "@/components/features/places/PlaceActionRow";
import { resolveSaveLink } from "@/lib/save-link";
import { getEntityStatus } from "@/lib/entity-status";
import { EntityStatusPill } from "@/components/ui/EntityStatusPill";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Save = {
  id: string;
  title: string;
  location: string;
  source: string;
  tags: string[];
  assigned: string | null;
  tripId: string | null;
  dayIndex: number | null;
  distance: string | null;
  img: string | null;
  needsPlaceConfirmation: boolean;
  userRating?: number | null;
  isBooked?: boolean;
  destinationCity: string | null;
  destinationCountry: string | null;
  communitySpotId: string | null;
  lat: number | null;
  lng: number | null;
  sourceUrl: string | null;
  websiteUrl: string | null;
  suggestionTier: "primary" | "secondary" | null;
  hasBooking: boolean;
  hasItineraryLink: boolean;
  tripStatus: string | null;
  tripEndDate: string | null;
  sourceMethod: string | null;
};

export type ApiItem = {
  id: string;
  rawTitle: string | null;
  placePhotoUrl: string | null;
  mediaThumbnailUrl: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  categoryTags: string[];
  sourceMethod: string | null;
  sourcePlatform: string | null;
  savedAt: string;
  tripId: string | null;
  dayIndex: number | null;
  trip: { id: string; title: string } | null;
  needsPlaceConfirmation: boolean;
  userRating?: number | null;
  isBooked?: boolean;
  communitySpotId: string | null;
  lat: number | null;
  lng: number | null;
  sourceUrl: string | null;
  websiteUrl: string | null;
  hasBooking?: boolean;
  hasItineraryLink?: boolean;
  tripStatus?: string | null;
  tripEndDate?: string | null;
};

export const SOURCE_LABEL_MAP: Record<string, string> = {
  URL_PASTE: "URL save", EMAIL_FORWARD: "Email", IN_APP_SAVE: "Saved in app", SHARED_TRIP_IMPORT: "Flokk share",
  instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", google_maps: "Google Maps",
  airbnb: "Airbnb", getyourguide: "GetYourGuide", viator: "Viator", klook: "Klook",
  INSTAGRAM: "Instagram", TIKTOK: "TikTok", GOOGLE_MAPS: "Google Maps",
  MANUAL: "URL save", IN_APP: "Saved in app", EMAIL_IMPORT: "Email", PHOTO_IMPORT: "URL save",
};

export function resolveTitle(rawTitle: string | null, city: string | null): string {
  if (!rawTitle) return "Saved place";
  if (rawTitle.startsWith("http")) {
    return city ? `Place in ${city}` : "Saved place";
  }
  return rawTitle;
}

export function mapApiItem(item: ApiItem): Save {
  return {
    id: item.id,
    title: resolveTitle(item.rawTitle, item.destinationCity),
    location: [item.destinationCity, item.destinationCountry].filter(Boolean).join(", "),
    source: SOURCE_LABEL_MAP[item.sourcePlatform ?? ""] || SOURCE_LABEL_MAP[item.sourceMethod ?? ""] || item.sourceMethod || "",
    tags: item.categoryTags,
    assigned: item.trip?.title ?? null,
    tripId: item.tripId ?? null,
    dayIndex: item.dayIndex ?? null,
    distance: null,
    img: getItemImage(item.rawTitle, item.placePhotoUrl, item.mediaThumbnailUrl, item.categoryTags[0] ?? null, item.destinationCity, item.destinationCountry),
    needsPlaceConfirmation: item.needsPlaceConfirmation ?? false,
    userRating: item.userRating ?? undefined,
    isBooked: item.isBooked ?? false,
    destinationCity: item.destinationCity ?? null,
    destinationCountry: item.destinationCountry ?? null,
    communitySpotId: item.communitySpotId ?? null,
    lat: item.lat ?? null,
    lng: item.lng ?? null,
    sourceUrl: item.sourceUrl ?? null,
    websiteUrl: item.websiteUrl ?? null,
    suggestionTier: null,
    hasBooking: item.hasBooking ?? false,
    hasItineraryLink: item.hasItineraryLink ?? false,
    tripStatus: item.tripStatus ?? null,
    tripEndDate: item.tripEndDate ?? null,
    sourceMethod: item.sourceMethod ?? null,
  };
}

// ─── SaveCard ─────────────────────────────────────────────────────────────────

export type SaveCardProps = {
  save: Save;
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  assignTrip: (id: string, trip: string) => void;
  onTripClick: (tripName: string) => void;
  onCardClick: (id: string) => void;
  availableTrips: { id: string; title: string; endDate?: string | null }[];
  onDeleted?: (id: string) => void;
  onIdentifyPlace?: (id: string) => void;
  onRateClick?: (id: string, title: string) => void;
  ratedItemId?: string | null;
  onAssignCity?: (id: string) => void;
  suggestedForOptions?: Array<{ id: string; name: string }>;
  onAddToTrip?: (saveId: string, options: Array<{ id: string; name: string }>) => void;
  onGrowTripCity?: (saveId: string) => void;
  growTripCityLabel?: string;
  cardContext?: "upcoming_explicit" | "past";
  readOnly?: boolean;
  onShareToast?: (message: string) => void;
};

export function SaveCard({ save, openDropdown, setOpenDropdown, assignTrip, onTripClick, onCardClick, availableTrips, onDeleted, onIdentifyPlace, onRateClick, ratedItemId, onAssignCity, suggestedForOptions, onAddToTrip, onGrowTripCity, growTripCityLabel, cardContext, readOnly = false, onShareToast }: SaveCardProps) {
  const filteredTags = save.tags.filter(t => {
    if (t.startsWith("list:")) return false;
    if (t.toLowerCase() === "other" && save.tags.some(t2 =>
      !["other", "vg", "vgn"].includes(t2.toLowerCase()) && t2.toLowerCase() !== t.toLowerCase()
    )) return false;
    return true;
  });
  const listTag = save.tags.find(t => t.startsWith("list:"));
  const listLabel = listTag ? listTag.slice(5) : null;
  const isDropdownOpen = openDropdown === save.id;
  const [deleting, setDeleting] = useState(false);
  const isTransit = save.tags.some(t => ["flight", "flights", "transportation", "transit", "train"].includes(t.toLowerCase()));
  const isPastTrip = cardContext === "past";
  const placeForActionRow = {
    name: save.title,
    city: save.destinationCity ?? null,
    country: save.destinationCountry ?? null,
    websiteUrl: resolveSaveLink({
        websiteUrl: save.websiteUrl,
        sourceUrl: save.sourceUrl,
        lat: save.lat,
        lng: save.lng,
        rawTitle: save.title,
        destinationCity: save.destinationCity,
      })?.url ?? null,
    lat: save.lat ?? null,
    lng: save.lng ?? null,
    shareEntityType: "saved_item" as const,
    shareEntityId: save.id,
  };

  const statusResult = getEntityStatus({
    dayIndex: save.dayIndex,
    hasItineraryLink: save.hasItineraryLink,
    hasBooking: save.hasBooking,
    userRating: save.userRating ?? null,
    tripStatus: save.tripStatus,
    tripEndDate: save.tripEndDate,
  });

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Remove this save?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/saves/${save.id}`, { method: "DELETE" });
      if (res.ok) onDeleted?.(save.id);
    } catch {
      // silent
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div id={`save-${save.id}`} onClick={() => onCardClick(save.id)} style={{ cursor: "pointer" }}>
    <div
      className="group"
      style={{
        backgroundColor: "#FAFAFA",
        borderRadius: "12px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        overflow: "visible",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Delete button — hidden in readOnly mode */}
      {!readOnly && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur-sm rounded-full shadow-sm border border-gray-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 opacity-100"
          style={{ padding: "5px", lineHeight: 0, cursor: deleting ? "default" : "pointer" }}
        >
          <Trash2 size={13} style={{ color: deleting ? "#ccc" : "#9ca3af" }} />
        </button>
      )}

      {/* Thumbnail */}
      {save.img ? (
        <div
          style={{
            height: "130px",
            backgroundImage: `url(${save.img})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            position: "relative",
            borderRadius: "12px 12px 0 0",
            overflow: "hidden",
          }}
        >
          {/* Status pill — top-right (Tier 2/3 only) */}
          {save.suggestionTier === "secondary" && save.destinationCountry && (
            <div style={{ position: "absolute", top: "8px", right: "8px", zIndex: 2 }}>
              <Pill variant="status">Flokking around {save.destinationCountry}</Pill>
            </div>
          )}
          {/* VG/VGN dietary pill — bottom-right, unchanged */}
          {(save.tags.includes("VGN") || save.tags.includes("VG")) && (
            <div
              style={{
                position: "absolute",
                bottom: "6px",
                right: "8px",
                backgroundColor: "#16a34a",
                color: "#fff",
                fontSize: "10px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "20px",
              }}
            >
              {save.tags.includes("VGN") ? "VGN" : "VG"}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            height: "130px",
            backgroundColor: "#f1f5f9",
            borderRadius: "12px 12px 0 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {/* Status pill on no-image fallback */}
          {save.suggestionTier === "secondary" && save.destinationCountry && (
            <div style={{ position: "absolute", top: "8px", right: "8px", zIndex: 2 }}>
              <Pill variant="status">Flokking around {save.destinationCountry}</Pill>
            </div>
          )}
          <span style={{ fontSize: "13px", color: "#94a3b8" }}>
            {categoryLabel(filteredTags[0]) || "Saved place"}
          </span>
        </div>
      )}

      {/* Card body */}
      <div style={{ padding: "12px" }}>
        {/* Title */}
        <p
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#1a1a1a",
            marginBottom: "2px",
            lineHeight: 1.3,
          }}
        >
          {save.title}
        </p>

        {/* Place identification prompt */}
        {save.needsPlaceConfirmation && onIdentifyPlace && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: "#999" }}>What place is this?</span>
            <button
              onClick={(e) => { e.stopPropagation(); onIdentifyPlace(save.id); }}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "11px", color: "#C4664A", fontWeight: 600, fontFamily: "inherit" }}
            >
              Identify place →
            </button>
          </div>
        )}

        {/* Location */}
        {save.location && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              marginBottom: "6px",
            }}
          >
            <MapPin size={10} style={{ color: "#717171", flexShrink: 0 }} />
            <span style={{ fontSize: "12px", color: "#717171" }}>{save.location}</span>
          </div>
        )}

        {/* Entity status pill */}
        {statusResult.status !== "saved" ? (
          <div style={{ marginBottom: "6px" }}>
            <EntityStatusPill
              status={statusResult.status}
              label={statusResult.label}
              color={statusResult.color}
            />
          </div>
        ) : null}

        {/* Tags */}
        <div style={{ marginBottom: listLabel ? "4px" : "8px" }}>
          <CategoryBadges slugs={filteredTags} variant="compact" />
        </div>
        {listLabel && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px" }}>
            <Bookmark size={10} style={{ color: "#717171", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: "#717171", fontWeight: 500 }}>{listLabel}</span>
          </div>
        )}

        {/* Trip assignment dropdown — hidden in readOnly mode */}
        {!readOnly && !save.tripId && cardContext !== "past" && !suggestedForOptions?.length && (
          <div style={{ position: "relative" }}>
            {isDropdownOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: "4px",
                  backgroundColor: "#fff",
                  border: "1px solid rgba(0,0,0,0.1)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  borderRadius: "8px",
                  zIndex: 50,
                  minWidth: "180px",
                  overflow: "hidden",
                  maxHeight: "280px",
                  overflowY: "auto",
                }}
              >
                {(() => {
                  const todayStr = new Date().toISOString();
                  const upcoming = availableTrips.filter(t => !t.endDate || t.endDate >= todayStr);
                  const past = availableTrips.filter(t => t.endDate && t.endDate < todayStr);
                  const tripBtn = (title: string, key: string, isLast: boolean) => (
                    <button
                      key={key}
                      onClick={(e) => { e.stopPropagation(); assignTrip(save.id, title); }}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: "13px", color: "#1a1a1a", fontWeight: 400, background: "none", border: "none", cursor: "pointer", borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.06)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F9F9F9"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                    >
                      {title}
                    </button>
                  );
                  return (
                    <>
                      {upcoming.map((t, i) => tripBtn(t.title, t.id, i === upcoming.length - 1 && past.length === 0))}
                      {past.length > 0 && (
                        <>
                          <div style={{ padding: "5px 14px", fontSize: "11px", fontWeight: 600, color: "#AAAAAA", backgroundColor: "#F9F9F9", borderTop: "1px solid rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                            Past trips
                          </div>
                          {past.map((t, i) => tripBtn(t.title, t.id, i === past.length - 1))}
                        </>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); assignTrip(save.id, "+ Create new trip"); }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: "13px", color: "#C4664A", fontWeight: 600, background: "none", border: "none", cursor: "pointer", borderTop: "1px solid rgba(0,0,0,0.06)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F9F9F9"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                      >
                        + Create new trip
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Unified action row */}
        <div style={{ marginTop: "10px" }} onClick={(e) => e.stopPropagation()}>
          <PlaceActionRow
            variant="card-compact"
            place={placeForActionRow}
            isSaved={true}
            userRating={save.userRating ?? null}
            showAddToItinerary={statusResult.showAffordance}
            onAddToTrip={
              readOnly
                ? undefined
                : !save.tripId && !isPastTrip && !suggestedForOptions?.length
                  ? () => setOpenDropdown(isDropdownOpen ? null : save.id)
                  : onAddToTrip && suggestedForOptions && suggestedForOptions.length > 0
                    ? () => { onAddToTrip!(save.id, suggestedForOptions!); }
                    : undefined
            }
            onRate={!isTransit && !readOnly && onRateClick ? () => { onRateClick!(save.id, save.title); } : undefined}
            onShareToast={onShareToast}
          />
        </div>
      </div>
    </div>
    </div>
  );
}
