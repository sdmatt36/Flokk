"use client";

import { useState } from "react";
import { MapPin, Trash2 } from "lucide-react";
import { SaveDetailModal } from "@/components/features/saves/SaveDetailModal";
import { getItemImage } from "@/lib/destination-images";

export type RecentSaveItem = {
  id: string;
  rawTitle: string | null;
  placePhotoUrl: string | null;
  mediaThumbnailUrl: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  categoryTags: string[];
};

const TAG_GRADIENT: Record<string, string> = {
  Kids: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
  Activity: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
  Culture: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
  History: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
  Food: "linear-gradient(135deg,#f97316,#ea580c)",
  "Street Food": "linear-gradient(135deg,#f97316,#ea580c)",
  Outdoor: "linear-gradient(135deg,#22c55e,#15803d)",
  Beach: "linear-gradient(135deg,#0ea5e9,#0284c7)",
  Lodging: "linear-gradient(135deg,#f59e0b,#d97706)",
};

function getGradient(tags: string[]) {
  for (const t of tags) if (TAG_GRADIENT[t]) return TAG_GRADIENT[t];
  return "linear-gradient(135deg,#2d3436,#636e72)";
}

// Title-keyword location fallback when DB has no city/country
const TITLE_LOCATIONS: Array<[RegExp, string]> = [
  [/shuri/i, "Naha, Okinawa"],
  [/katsuren/i, "Uruma, Okinawa"],
  [/okinawa/i, "Okinawa, Japan"],
];

function getImageSrc(item: RecentSaveItem): string {
  return getItemImage(item.rawTitle, item.placePhotoUrl, item.mediaThumbnailUrl, item.categoryTags[0] ?? null, item.destinationCity, item.destinationCountry);
}

function getLocation(item: RecentSaveItem): string {
  const loc = [item.destinationCity, item.destinationCountry].filter(Boolean).join(", ");
  if (loc) return loc;
  const title = item.rawTitle ?? "";
  for (const [pattern, location] of TITLE_LOCATIONS) {
    if (pattern.test(title)) return location;
  }
  return "";
}

export function RecentSavesCards({ items, onDelete }: { items: RecentSaveItem[]; onDelete?: (id: string) => void }) {
  const [modalItemId, setModalItemId] = useState<string | null>(null);
  const [assignedTrips, setAssignedTrips] = useState<Record<string, string>>({});

  return (
    <>
      <div className="grid grid-cols-3 md:grid-cols-3 sm:grid-cols-1" style={{ gap: "16px", display: "grid", alignItems: "stretch" }}>
        {items.map((item) => {
          const tags = item.categoryTags ?? [];
          const loc = getLocation(item);
          const imgSrc = getImageSrc(item);
          return (
            <div
              key={item.id}
              onClick={() => setModalItemId(item.id)}
              style={{ cursor: "pointer", textDecoration: "none", height: "100%" }}
            >
              <div style={{ backgroundColor: "#FAFAFA", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "hidden", position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{
                    height: "130px",
                    backgroundImage: `url(${imgSrc})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }} />
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                    style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                  >
                    <Trash2 size={13} style={{ color: "#fff" }} />
                  </button>
                )}
                <div style={{ padding: "12px", flex: 1 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>
                    {item.rawTitle?.startsWith("http")
                      ? (item.destinationCity ? `Place in ${item.destinationCity}` : "Saved place")
                      : (item.rawTitle ?? "Saved place")}
                  </p>
                  {loc && (
                    <div style={{ display: "flex", alignItems: "center", gap: "3px", marginBottom: "6px" }}>
                      <MapPin size={10} style={{ color: "#717171", flexShrink: 0 }} />
                      <span style={{ fontSize: "12px", color: "#717171" }}>{loc}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {tags.slice(0, 2).map(tag => (
                      <span key={tag} style={{ fontSize: "11px", backgroundColor: "rgba(0,0,0,0.05)", color: "#666", borderRadius: "20px", padding: "2px 8px" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  {assignedTrips[item.id] && (
                    <div style={{ marginTop: "6px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#C4664A", color: "#fff", borderRadius: "999px", padding: "2px 8px" }}>
                        {assignedTrips[item.id]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modalItemId && (
        <SaveDetailModal
          itemId={modalItemId}
          onClose={() => setModalItemId(null)}
          onAssigned={(itemId, trip) => setAssignedTrips(prev => ({ ...prev, [itemId]: trip.title }))}
        />
      )}
    </>
  );
}
