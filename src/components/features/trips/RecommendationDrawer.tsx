"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MapPin, Heart, Clock, Users, Sparkles, X, CheckCircle } from "lucide-react";

export type DrawerRec = {
  title: string;
  location: string;
  img: string;
  tags: string;
  match: string;
  saved: number;
  lat: number;
  lng: number;
  description?: string;
  hours?: string;
  ages?: string;
  website?: string;
  bookUrl?: string;
};

type DayPill = { dayIndex: number; label: string };

export function RecommendationDrawer({
  item,
  tripId,
  dayPills,
  onClose,
  onAddedToDay,
}: {
  item: DrawerRec | null;
  tripId?: string;
  dayPills: DayPill[];
  onClose: () => void;
  onAddedToDay?: (dayIndex: number, title: string) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [heartFilled, setHeartFilled] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [addedDay, setAddedDay] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Reset state whenever item changes
  useEffect(() => {
    setImgFailed(false);
    setDescExpanded(false);
    setSelectedDay(null);
    setAdding(false);
    setAddedDay(null);
  }, [item?.title]);

  // Escape key to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleAddToItinerary = useCallback(async () => {
    if (!item || adding || addedDay !== null) return;
    if (selectedDay === null) return;

    setAdding(true);
    try {
      if (tripId) {
        // Persist to DB
        await fetch(`/api/trips/${tripId}/itinerary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            location: item.location,
            imageUrl: item.img,
            dayIndex: selectedDay,
            lat: item.lat,
            lng: item.lng,
            categoryTags: [item.tags.split(" · ")[0]],
          }),
        });
      }
      // Also write to localStorage for immediate itinerary display
      const ITINERARY_KEY = `flokk_itinerary_additions_${tripId ?? "default"}`;
      try {
        const existing = JSON.parse(localStorage.getItem(ITINERARY_KEY) ?? "[]");
        existing.push({ dayIndex: selectedDay, title: item.title, location: item.location, img: item.img });
        localStorage.setItem(ITINERARY_KEY, JSON.stringify(existing));
      } catch {}
      window.dispatchEvent(new Event("flokk:refresh"));

      setAddedDay(selectedDay);
      onAddedToDay?.(selectedDay, item.title);
    } finally {
      setAdding(false);
    }
  }, [item, tripId, selectedDay, adding, addedDay, onAddedToDay]);

  if (!mounted || !item) return null;

  const category = item.tags.split(" · ")[0];
  const price = item.tags.split(" · ")[1] ?? "";
  const duration = item.tags.split(" · ")[2] ?? "";
  const descText = item.description ?? item.match;
  const isLong = descText.length > 160;
  const displayDesc = !descExpanded && isLong ? descText.slice(0, 160) + "…" : descText;

  const drawerContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        style={{ touchAction: "none" }}
      />

      {/* Drawer panel */}
      <div
        className="fixed z-50 bg-white overflow-y-auto"
        style={{
          // Mobile: bottom sheet
          bottom: 0,
          left: 0,
          right: 0,
          borderRadius: "20px 20px 0 0",
          maxHeight: "88vh",
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: "40px", height: "4px", borderRadius: "2px", backgroundColor: "#E0E0E0" }} />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{ position: "absolute", top: "16px", right: "16px", width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.08)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <X size={16} style={{ color: "#555" }} />
        </button>

        {/* Hero image */}
        {imgFailed ? (
          <div style={{ width: "100%", height: "208px", backgroundColor: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MapPin size={36} style={{ color: "#ccc" }} />
          </div>
        ) : (
          <>
            <div style={{ width: "100%", height: "208px", backgroundImage: `url('${item.img}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
            <img src={item.img} alt="" onError={() => setImgFailed(true)} style={{ display: "none" }} />
          </>
        )}

        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 20px 0" }}>
          <p style={{ fontSize: "20px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.2, flex: 1, paddingRight: "12px", fontFamily: "'Playfair Display', Georgia, serif" }}>
            {item.title}
          </p>
          <button
            onClick={() => setHeartFilled(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", flexShrink: 0 }}
          >
            <Heart size={22} style={{ color: heartFilled ? "#C4664A" : "#ccc", fill: heartFilled ? "#C4664A" : "none", transition: "all 0.15s" }} />
          </button>
        </div>

        {/* Meta row */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 20px 0", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            <MapPin size={11} style={{ color: "#717171" }} />
            <span style={{ fontSize: "13px", color: "#717171" }}>{item.location}</span>
          </div>
          {category && <span style={{ fontSize: "11px", backgroundColor: "rgba(0,0,0,0.06)", color: "#555", borderRadius: "20px", padding: "2px 8px" }}>{category}</span>}
          {price && <span style={{ fontSize: "13px", color: "#717171" }}>{price}</span>}
          {duration && (
            <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <Clock size={11} style={{ color: "#717171" }} />
              <span style={{ fontSize: "13px", color: "#717171" }}>{duration}</span>
            </div>
          )}
        </div>

        {/* Family match reason */}
        <div style={{ margin: "14px 20px 0", borderLeft: "2px solid #C4664A", paddingLeft: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "3px" }}>
            <Sparkles size={12} style={{ color: "#C4664A" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#C4664A", textTransform: "uppercase", letterSpacing: "0.05em" }}>Why we picked this</span>
          </div>
          <p style={{ fontSize: "13px", color: "#1B3A5C", lineHeight: 1.5 }}>{item.match}</p>
        </div>

        {/* Description */}
        {descText && (
          <div style={{ padding: "12px 20px 0" }}>
            <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.6 }}>
              {displayDesc}
              {isLong && (
                <button
                  onClick={() => setDescExpanded(v => !v)}
                  style={{ background: "none", border: "none", color: "#C4664A", fontSize: "13px", fontWeight: 600, cursor: "pointer", padding: "0 0 0 4px" }}
                >
                  {descExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </p>
          </div>
        )}

        {/* Hours */}
        {item.hours && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 20px 0" }}>
            <Clock size={13} style={{ color: "#717171", flexShrink: 0 }} />
            <span style={{ fontSize: "13px", color: "#555" }}>{item.hours}</span>
          </div>
        )}

        {/* Families saved */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "10px 20px 0" }}>
          <Users size={12} style={{ color: "#AAAAAA" }} />
          <span style={{ fontSize: "12px", color: "#AAAAAA" }}>{item.saved.toLocaleString()} families saved this</span>
        </div>

        {/* Maps quick links */}
        <div style={{ display: "flex", gap: "12px", padding: "10px 20px 0" }}>
          <a
            href={`https://maps.apple.com/?q=${encodeURIComponent(item.title)}&ll=${item.lat},${item.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "12px", color: "#717171", textDecoration: "underline" }}
          >
            Open in Apple Maps
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "12px", color: "#717171", textDecoration: "underline" }}
          >
            Open in Google Maps
          </a>
        </div>

        {/* Spacer before sticky bottom */}
        <div style={{ height: "100px" }} />

        {/* Sticky bottom: day picker + add button */}
        <div style={{ position: "sticky", bottom: 0, backgroundColor: "#fff", borderTop: "1px solid #F0F0F0", padding: "16px 20px", paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
          {addedDay !== null ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px", borderRadius: "12px", backgroundColor: "rgba(74,124,89,0.1)", border: "1px solid rgba(74,124,89,0.2)" }}>
              <CheckCircle size={16} style={{ color: "#4a7c59" }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#4a7c59" }}>Added to Day {addedDay + 1} ✓</span>
            </div>
          ) : (
            <>
              {dayPills.length > 0 && (
                <div style={{ marginBottom: "12px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "8px" }}>Which day?</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {dayPills.map(({ dayIndex, label }) => (
                      <button
                        key={dayIndex}
                        type="button"
                        onClick={() => setSelectedDay(selectedDay === dayIndex ? null : dayIndex)}
                        style={{ padding: "5px 12px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, border: "1.5px solid", borderColor: selectedDay === dayIndex ? "#C4664A" : "#DDD", backgroundColor: selectedDay === dayIndex ? "#C4664A" : "#fff", color: selectedDay === dayIndex ? "#fff" : "#666", cursor: "pointer" }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={handleAddToItinerary}
                disabled={adding || (dayPills.length > 0 && selectedDay === null)}
                style={{ width: "100%", padding: "14px", backgroundColor: (adding || (dayPills.length > 0 && selectedDay === null)) ? "#E0E0E0" : "#C4664A", color: (adding || (dayPills.length > 0 && selectedDay === null)) ? "#aaa" : "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: (adding || (dayPills.length > 0 && selectedDay === null)) ? "default" : "pointer" }}
              >
                {adding ? "Adding…" : selectedDay !== null ? `+ Add to Day ${selectedDay + 1}` : dayPills.length > 0 ? "Select a day first" : "+ Add to Itinerary"}
              </button>
              {item.bookUrl && (
                <button
                  type="button"
                  onClick={() => window.open(item.bookUrl, "_blank")}
                  style={{ width: "100%", marginTop: "10px", padding: "13px", backgroundColor: "#fff", color: "#C4664A", border: "1.5px solid #C4664A", borderRadius: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
                >
                  Book this experience
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(drawerContent, document.body);
}
