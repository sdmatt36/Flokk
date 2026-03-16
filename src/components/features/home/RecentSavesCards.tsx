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

const CITY_IMAGES: Record<string, string> = {
  "kyoto": "photo-1478436127897-769e1b3f0f36",
  "tokyo": "photo-1540959733332-eab4deabeeaf",
  "okinawa": "photo-1590559899731-a382839e5549",
  "osaka": "photo-1555400038-63f5ba517a47",
  "japan": "photo-1478436127897-769e1b3f0f36",
  "costa rica": "photo-1518259102261-b40117eabbc9",
  "paris": "photo-1502602898657-3e91760cbb34",
  "london": "photo-1513635269975-59663e0ac1ad",
  "new york": "photo-1485871981521-5b1fd3805eee",
  "bali": "photo-1537996194471-e657df975ab4",
  "madrid": "photo-1539037116277-4db20889f2d4",
  "lisbon": "photo-1555881400-74d7acaacd8b",
};

// Title-keyword image overrides — used when DB thumbnail is unreliable
const TITLE_IMAGES: Array<[RegExp, string]> = [
  [/shuri/i, "photo-1610976689391-c749d937dcab"],
  [/churaumi|ocean expo/i, "photo-1590559899731-a382839e5549"],
  [/kokusai/i, "photo-1540959733332-eab4deabeeaf"],
  [/katsuren/i, "photo-1590559899731-a382839e5549"],
];

// Title-keyword location fallback when DB has no city/country
const TITLE_LOCATIONS: Array<[RegExp, string]> = [
  [/shuri|kokusai|naha/i, "Naha, Okinawa"],
  [/churaumi|ocean expo|motobu/i, "Motobu, Okinawa"],
  [/katsuren/i, "Uruma, Okinawa"],
  [/okinawa/i, "Okinawa, Japan"],
];

function getImageSrc(item: RecentSaveItem): string {
  const title = item.rawTitle ?? "";
  // Check title overrides first (fixes bad scraped thumbnails for known places)
  for (const [pattern, photoId] of TITLE_IMAGES) {
    if (pattern.test(title)) return `https://images.unsplash.com/${photoId}?w=400&q=80`;
  }
  // Only trust mediaThumbnailUrl when location was also successfully extracted
  if (item.mediaThumbnailUrl && (item.destinationCity || item.destinationCountry)) {
    return item.mediaThumbnailUrl;
  }
  const city = (item.destinationCity || "").toLowerCase();
  const country = (item.destinationCountry || "").toLowerCase();
  const photoId = CITY_IMAGES[city] || CITY_IMAGES[country] || "photo-1476514525535-07fb3b4ae5f1";
  return `https://images.unsplash.com/${photoId}?w=400&q=80`;
}

function getLocation(item: RecentSaveItem): string {
  const loc = [item.destinationCity, item.destinationCountry].filter(Boolean).join(", ");
  if (loc) return loc;
  // Infer from title when DB location is missing
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
      <div className="grid grid-cols-3 md:grid-cols-3 sm:grid-cols-1" style={{ gap: "16px" }}>
        {items.map((item) => {
          const tags = item.categoryTags ?? [];
          const loc = getLocation(item);
          const gradient = getGradient(tags);
          return (
            <div
              key={item.id}
              onClick={() => setModalItemId(item.id)}
              style={{ cursor: "pointer", textDecoration: "none" }}
            >
              <div style={{ backgroundColor: "#FAFAFA", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "hidden" }}>
                <div style={{
                  height: "130px",
                  background: gradient,
                  backgroundImage: `url(${getImageSrc(item)})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }} />
                <div style={{ padding: "12px" }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px", lineHeight: 1.3 }}>
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
