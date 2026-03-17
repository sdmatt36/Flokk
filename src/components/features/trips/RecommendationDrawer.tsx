"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Heart, MapPin, Users, Sparkles, CheckCircle } from "lucide-react";

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
  const [mounted, setMounted] = useState(false);
  const [heartFilled, setHeartFilled] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addedDay, setAddedDay] = useState<number | null>(null);
  // Drag-to-dismiss state
  const [dragStartY, setDragStartY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    setHeartFilled(false);
    setShowDayPicker(false);
    setAdding(false);
    setAdded(false);
    setAddedDay(null);
  }, [item?.title]);

  useEffect(() => {
    if (!item) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  const handleAddToDay = async (dayIndex: number) => {
    if (adding || added) return;
    setAdding(true);
    try {
      if (tripId) {
        await fetch(`/api/trips/${tripId}/itinerary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item!.title,
            location: item!.location,
            imageUrl: item!.img,
            dayIndex,
            lat: item!.lat,
            lng: item!.lng,
            categoryTags: [item!.tags.split(" · ")[0]],
          }),
        });
      }
      const key = `flokk_itinerary_additions_${tripId ?? "default"}`;
      try {
        const existing = JSON.parse(localStorage.getItem(key) ?? "[]");
        existing.push({ dayIndex, title: item!.title, location: item!.location, img: item!.img });
        localStorage.setItem(key, JSON.stringify(existing));
      } catch { /* ignore */ }
      window.dispatchEvent(new Event("flokk:refresh"));
      setAdded(true);
      setAddedDay(dayIndex);
      setShowDayPicker(false);
      onAddedToDay?.(dayIndex, item!.title);
    } catch (e) {
      console.error("Failed to add to itinerary", e);
    } finally {
      setAdding(false);
    }
  };

  if (!mounted || !item) return null;

  const category = item.tags.split(" · ")[0];
  const price = item.tags.split(" · ")[1] ?? "";
  const duration = item.tags.split(" · ")[2] ?? "";

  const drawerBody = (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
        style={{ touchAction: "none" }}
      />
      {/* Desktop backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 hidden md:block"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={[
          "fixed z-50 bg-white",
          // Mobile: bottom sheet
          "bottom-0 left-0 right-0 rounded-t-2xl max-h-[82vh] overflow-y-auto",
          // Desktop: right panel
          "md:bottom-0 md:top-0 md:left-auto md:right-0 md:w-[420px] md:rounded-none md:rounded-l-2xl md:h-full md:overflow-y-auto",
          "shadow-2xl",
        ].join(" ")}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div
          className="flex justify-center pt-3 pb-1 md:hidden cursor-grab active:cursor-grabbing"
          onTouchStart={e => { setDragStartY(e.touches[0].clientY); setIsDragging(true); }}
          onTouchEnd={e => {
            if (isDragging) {
              const delta = e.changedTouches[0].clientY - dragStartY;
              if (delta > 80) onClose();
              setIsDragging(false);
            }
          }}
        >
          <div style={{ width: "40px", height: "4px", borderRadius: "2px", backgroundColor: "#E0E0E0" }} />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: "14px", right: "14px", zIndex: 10,
            width: "30px", height: "30px", borderRadius: "50%",
            backgroundColor: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)",
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }}
        >
          <X size={14} style={{ color: "#555" }} />
        </button>

        {/* Hero image */}
        {item.img ? (
          <div
            style={{
              width: "100%", height: "176px",
              backgroundImage: `url('${item.img}')`,
              backgroundSize: "cover", backgroundPosition: "center",
            }}
          />
        ) : (
          <div style={{ width: "100%", height: "176px", backgroundColor: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MapPin size={32} style={{ color: "#ccc" }} />
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", padding: "16px 20px 0" }}>
          <p style={{ fontSize: "20px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.2, flex: 1, fontFamily: "'Playfair Display', Georgia, serif" }}>
            {item.title}
          </p>
          <button
            onClick={() => setHeartFilled(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", flexShrink: 0, marginTop: "2px" }}
          >
            <Heart size={20} style={{ color: heartFilled ? "#C4664A" : "#ccc", fill: heartFilled ? "#C4664A" : "none", transition: "all 0.15s" }} />
          </button>
        </div>

        {/* Meta */}
        <p style={{ fontSize: "13px", color: "#717171", padding: "4px 20px 0" }}>
          {item.location.split(",")[0]}
          {category ? ` · ${category}` : ""}
          {price ? ` · ${price}` : ""}
          {duration ? ` · ${duration}` : ""}
        </p>

        {/* Match reason */}
        {item.match && (
          <div style={{ margin: "14px 20px 0", borderLeft: "2px solid #C4664A", paddingLeft: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "3px" }}>
              <Sparkles size={11} style={{ color: "#C4664A" }} />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#C4664A", textTransform: "uppercase", letterSpacing: "0.05em" }}>Why we picked this</span>
            </div>
            <p style={{ fontSize: "13px", color: "#1B3A5C", lineHeight: 1.5 }}>{item.match}</p>
          </div>
        )}

        {/* Families saved */}
        {item.saved > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "10px 20px 0" }}>
            <Users size={12} style={{ color: "#AAAAAA" }} />
            <span style={{ fontSize: "12px", color: "#AAAAAA" }}>{item.saved.toLocaleString()} families saved this</span>
          </div>
        )}

        {/* Map links */}
        <div style={{ display: "flex", gap: "16px", padding: "10px 20px 0" }}>
          <a
            href={`https://maps.apple.com/?ll=${item.lat},${item.lng}&q=${encodeURIComponent(item.title)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "12px", color: "#1B3A5C", textDecoration: "underline", textUnderlineOffset: "2px" }}
          >
            Apple Maps
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "12px", color: "#1B3A5C", textDecoration: "underline", textUnderlineOffset: "2px" }}
          >
            Google Maps
          </a>
        </div>

        {/* Spacer before sticky CTA */}
        <div style={{ height: "80px" }} />

        {/* Sticky CTA */}
        <div
          className="sticky bottom-0 bg-white border-t border-gray-100 px-5 pt-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 1rem))" }}
        >
          {added ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "13px", borderRadius: "12px", backgroundColor: "rgba(74,124,89,0.1)", border: "1px solid rgba(74,124,89,0.2)" }}>
              <CheckCircle size={15} style={{ color: "#4a7c59" }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#4a7c59" }}>Added to Day {addedDay! + 1} ✓</span>
            </div>
          ) : !showDayPicker ? (
            <button
              type="button"
              onClick={() => dayPills.length > 0 ? setShowDayPicker(true) : handleAddToDay(0)}
              style={{ width: "100%", padding: "14px", backgroundColor: "#C4664A", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}
            >
              + Add to Itinerary
            </button>
          ) : (
            <div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#1B3A5C", marginBottom: "10px" }}>Which day?</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                {dayPills.map(day => (
                  <button
                    key={day.dayIndex}
                    type="button"
                    onClick={() => handleAddToDay(day.dayIndex)}
                    disabled={adding}
                    style={{
                      padding: "8px 14px", borderRadius: "12px",
                      border: "1.5px solid #E0E0E0",
                      backgroundColor: "#fff", fontSize: "13px",
                      color: "#1B3A5C", cursor: adding ? "default" : "pointer",
                      fontWeight: 500,
                    }}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowDayPicker(false)}
                style={{ background: "none", border: "none", fontSize: "12px", color: "#AAAAAA", cursor: "pointer", padding: 0 }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(drawerBody, document.body);
}
