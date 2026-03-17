"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { SaveDetailModal } from "@/components/features/saves/SaveDetailModal";

export type RecentSaveItem = {
  id: string;
  rawTitle: string | null;
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

function getImageSrc(item: RecentSaveItem): string | null {
  return item.mediaThumbnailUrl || null;
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

export function RecentSavesCards({ items }: { items: RecentSaveItem[] }) {
  const [modalItemId, setModalItemId] = useState<string | null>(null);

  return (
    <>
      <div className="grid grid-cols-3 md:grid-cols-3 sm:grid-cols-1" style={{ gap: "16px", alignItems: "start" }}>
        {items.map((item) => {
          const tags = item.categoryTags ?? [];
          const loc = getLocation(item);
          const gradient = getGradient(tags);
          const imgSrc = getImageSrc(item);
          return (
            <div
              key={item.id}
              onClick={() => setModalItemId(item.id)}
              style={{ cursor: "pointer", textDecoration: "none" }}
            >
              <div style={{ backgroundColor: "#FAFAFA", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "hidden" }}>
                {imgSrc ? (
                  <div style={{
                    height: "130px",
                    background: gradient,
                    backgroundImage: `url(${imgSrc})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }} />
                ) : (
                  <div style={{
                    height: "130px",
                    background: gradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <span style={{ fontSize: "36px", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
                      {(item.destinationCity || item.rawTitle || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div style={{ padding: "12px" }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>
                    {item.rawTitle ?? "Saved place"}
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
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modalItemId && (
        <SaveDetailModal itemId={modalItemId} onClose={() => setModalItemId(null)} />
      )}
    </>
  );
}
