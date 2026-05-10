"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { X, MapPin, Sparkles, ExternalLink, ChevronDown, Check } from "lucide-react";
import { LODGING_TYPE_LABELS, LODGING_TYPE_OPTIONS } from "@/lib/infer-lodging-type";
import { bucketTrips } from "@/lib/trip-phase";
import { getTripCoverImage } from "@/lib/destination-images";
import { shareEntity } from "@/lib/share";

type SaveItem = {
  id: string;
  rawTitle: string | null;
  rawDescription: string | null;
  mediaThumbnailUrl: string | null;
  placePhotoUrl: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  categoryTags: string[];
  sourceMethod: string | null;
  sourcePlatform: string | null;
  savedAt: string;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  affiliateUrl: string | null;
  websiteUrl: string | null;
  sourceUrl: string | null;
  isBooked: boolean;
  startTime: string | null;
  trip: { id: string; title: string } | null;
  userRating: number | null;
  lodgingType: string | null;
};

type Trip = { id: string; title: string; startDate: string | null; endDate: string | null; status?: string };

const SOURCE_LABEL: Record<string, string> = {
  URL_PASTE: "URL save", EMAIL_FORWARD: "Email", IN_APP_SAVE: "Saved in app", SHARED_TRIP_IMPORT: "Flokk share",
  instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", google_maps: "Google Maps",
  airbnb: "Airbnb", getyourguide: "GetYourGuide", viator: "Viator", klook: "Klook",
  INSTAGRAM: "Instagram", TIKTOK: "TikTok", GOOGLE_MAPS: "Google Maps",
  MANUAL: "URL save", IN_APP: "Saved in app", EMAIL_IMPORT: "Email", PHOTO_IMPORT: "URL save",
};

const TAG_GRADIENT: Record<string, string> = {
  Food: "linear-gradient(135deg,#f97316,#ea580c)",
  "Street Food": "linear-gradient(135deg,#f97316,#ea580c)",
  Outdoor: "linear-gradient(135deg,#22c55e,#15803d)",
  Hiking: "linear-gradient(135deg,#22c55e,#15803d)",
  Beach: "linear-gradient(135deg,#0ea5e9,#0284c7)",
  Kids: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
  Activity: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
  Culture: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
  History: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
  Wellness: "linear-gradient(135deg,#06b6d4,#0e7490)",
  Lodging: "linear-gradient(135deg,#f59e0b,#d97706)",
  Luxury: "linear-gradient(135deg,#f59e0b,#d97706)",
};

function getGradient(tags: string[]) {
  for (const t of tags) if (TAG_GRADIENT[t]) return TAG_GRADIENT[t];
  return "linear-gradient(135deg,#2d3436,#636e72)";
}

function cleanDisplayDescription(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw;
  s = s.replace(/^\d[\d,.KkMmBb]*\s*likes?,[\s\S]*?:\s*/i, "");
  s = s.replace(/^[\w.]+\s+on\s+\w+:\s*/i, "");
  s = s.replace(/#\w+/g, "");
  s = s.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{FE00}-\u{FEFF}\u{2300}-\u{27FF}]/gu, "");
  s = s.replace(/[\s.,"'"""]+$/, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  return s.length > 200 ? s.substring(0, 200) + "..." : s;
}

function buildMatchReason(tags: string[], interestKeys: string[]): string {
  if (tags.some(t => ["Kids","Activity","Educational"].includes(t)) || interestKeys.some(k => ["theme_parks","zoos","educational","hands_on","playgrounds"].includes(k)))
    return "A great pick for the whole family — built for kids but enjoyable for adults too.";
  if (tags.some(t => ["Food","Street Food"].includes(t)) || interestKeys.some(k => ["street_food","local_markets","food_tours","cafes"].includes(k)))
    return "Matches your family's love of local food — a must-try for food explorers.";
  if (tags.some(t => ["Culture","History","Museum"].includes(t)) || interestKeys.some(k => ["museums","history","art","architecture"].includes(k)))
    return "Lines up with your interest in culture and history — a rich local experience.";
  if (tags.some(t => ["Beach","Outdoor","Hiking","Water"].includes(t)) || interestKeys.some(k => ["beaches","hiking","national_parks","water_sports","wildlife"].includes(k)))
    return "Fits your family's taste for outdoor adventures and nature.";
  return "Saved based on your family's travel interests and upcoming trip.";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const ALL_CATEGORY_TAGS = ["Food & Drink", "Culture", "Experiences", "Lodging", "Adventure", "Kids Camps", "Nature", "Shopping", "Entertainment", "Wellness", "Nightlife", "Other"];

export function SaveDetailModal({
  itemId,
  onClose,
  onTagsUpdated,
  onMarkedBooked,
  onRemoveFromDay,
  onTimeSet,
  onAssigned,
}: {
  itemId: string;
  onClose: () => void;
  onTagsUpdated?: (itemId: string, tags: string[]) => void;
  onMarkedBooked?: (itemId: string) => void;
  onRemoveFromDay?: () => void;
  onTimeSet?: (itemId: string, time: string | null) => void;
  onAssigned?: (itemId: string, trip: { id: string; title: string }) => void;
}) {
  const [item, setItem] = useState<SaveItem | null>(null);
  const [interestKeys, setInterestKeys] = useState<string[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [notes, setNotes] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [startTime, setStartTime] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const [assignedTrip, setAssignedTrip] = useState<{ id: string; title: string } | null>(null);
  const [isBooked, setIsBooked] = useState(false);
  const [justShared, setJustShared] = useState(false);
  const [localTags, setLocalTags] = useState<string[]>([]);
  const [editingTags, setEditingTags] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [bodyDropdownOpen, setBodyDropdownOpen] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [localWebsiteUrl, setLocalWebsiteUrl] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState(false);
  const [lodgingType, setLodgingType] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const [showPastTrips, setShowPastTrips] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialNotes = useRef("");
  const initialTags = useRef<string[]>([]);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    fetch(`/api/saves/${itemId}`)
      .then(r => r.json())
      .then(data => {
        setItem(data.item);
        setInterestKeys(data.interestKeys ?? []);
        setNotes(data.item?.notes ?? "");
        setAssignedTrip(data.item?.trip ?? null);
        setIsBooked(data.item?.isBooked ?? false);
        setStartTime(data.item?.startTime ?? "");
        setLocalWebsiteUrl(data.item?.websiteUrl ?? null);
        setUserRating(data.item?.userRating ?? null);
        setLodgingType(data.item?.lodgingType ?? null);
        initialNotes.current = data.item?.notes ?? "";
        const tags = data.item?.categoryTags ?? [];
        setLocalTags(tags);
        initialTags.current = tags;
      });
    fetch("/api/trips?status=ALL")
      .then(r => r.json())
      .then(data => setTrips(data.trips ?? []));
  }, [itemId]);

  async function handleNotesBlur() {
    if (notes === initialNotes.current) return;
    setNoteSaving(true);
    try {
      await fetch(`/api/saves/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      initialNotes.current = notes;
      setNoteSaved(true);
      if (noteTimer.current) clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => setNoteSaved(false), 2500);
    } catch { /* silent */ }
    finally { setNoteSaving(false); }
  }

  async function handleAssignTrip(trip: Trip) {
    setBodyDropdownOpen(false);
    try {
      await fetch(`/api/saves/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id }),
      });
      setAssignedTrip(trip);
      onAssigned?.(itemId, trip);
    } catch { /* silent */ }
  }

  function handleClose() {
    // Fire-and-forget tag save if changed
    if (item && JSON.stringify(localTags.slice().sort()) !== JSON.stringify(initialTags.current.slice().sort())) {
      fetch(`/api/saves/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryTags: localTags }),
      }).catch(() => {/* silent */});
      onTagsUpdated?.(itemId, localTags);
    }
    onClose();
  }

  function toggleTag(tag: string) {
    setLocalTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  const tags = localTags;
  const gradient = getGradient(tags);
  const isFoodItem = tags.some(t => ["food", "food & drink"].includes(t.toLowerCase()));
  const location = [item?.destinationCity, item?.destinationCountry].filter(Boolean).join(", ");

  function cleanDesc(desc: string): string {
    return desc
      // Strip full Instagram engagement prefix: "17K likes, 122 comments - username on Instagram Date: "
      .replace(/^\d+[KkMm]?\s*likes?,\s*\d+\s*comments?\s*[-–]\s*[^\n]+?:\s*/i, "")
      .replace(/\d+[KkMm]?\s*likes?,?\s*/gi, "")
      .replace(/\d+\s*comments?,?\s*/gi, "")
      .replace(/[-–]\s*\w+\s+on\s+\w+\s+\d+,?\s*\d*:?\s*/gi, "")
      .replace(/#\w+/g, "")
      .replace(/^["']|["']$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getDisplayTitle(rawTitle: string | null, sourceUrl: string | null): string {
    if (rawTitle && !rawTitle.startsWith("http")) return rawTitle;
    const fallbackUrl = rawTitle ?? sourceUrl;
    if (fallbackUrl) {
      try { return new URL(fallbackUrl).hostname.replace(/^www\./, ""); } catch { /* */ }
    }
    return "Saved place";
  }

  return (
    <>
      <style>{`.directions-link:hover { text-decoration: underline; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 100,
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.25s ease",
        }}
      />

      {/* Modal panel */}
      <div
        style={{
          position: "fixed", bottom: 0, left: "50%",
          transform: mounted ? "translate(-50%, 0)" : "translate(-50%, 100%)",
          transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1)",
          width: "100%", maxWidth: "560px",
          maxHeight: "92vh", overflowY: "auto",
          backgroundColor: "#fff",
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
          zIndex: 101,
        }}
      >
        {/* Hero */}
        <div style={{ height: "220px", position: "relative", flexShrink: 0 }}>
          {(() => {
            const heroImg = item?.mediaThumbnailUrl ?? item?.placePhotoUrl;
            if (heroImg) {
              return <div style={{ width: "100%", height: "100%", backgroundImage: `url('${heroImg.replace("http://", "https://")}')`, backgroundSize: "cover", backgroundPosition: "center" }} />;
            }
            const coverImg = getTripCoverImage(item?.destinationCity, item?.destinationCountry, null);
            return <div style={{ width: "100%", height: "100%", backgroundImage: coverImg ? `url('${coverImg}')` : undefined, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "#1a1a1a" }} />;
          })()}
          {/* dark overlay for text legibility */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.65) 100%)" }} />

          {/* Close button */}
          <button
            onClick={handleClose}
            style={{
              position: "absolute", top: "14px", right: "14px", zIndex: 2,
              width: "32px", height: "32px", borderRadius: "50%",
              backgroundColor: "rgba(0,0,0,0.45)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={16} color="#fff" />
          </button>

          {/* Title + location */}
          {item && (
            <div style={{ position: "absolute", bottom: "16px", left: "20px", right: "48px", zIndex: 2 }}>
              <h2 style={{ fontSize: "22px", fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: "4px", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
                {getDisplayTitle(item.rawTitle, item.sourceUrl)}
              </h2>
              {location && (
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <MapPin size={12} style={{ color: "rgba(255,255,255,0.85)" }} />
                  <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>{location}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        {!item ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#999", fontSize: "14px" }}>Loading…</div>
        ) : (
          <div style={{ padding: "20px 20px 100px" }}>

            {/* Tags + source */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "6px", alignItems: "center" }}>
              {tags.length > 0 ? tags.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)} style={{ fontSize: "11px", fontWeight: 600, background: "#C4664A", color: "#fff", borderRadius: "999px", padding: "3px 10px", border: "none", cursor: "pointer" }}>
                  {tag}
                </button>
              )) : (
                <span style={{ fontSize: "12px", color: "#aaa" }}>No tags yet</span>
              )}
              <button
                onClick={() => setEditingTags(e => !e)}
                style={{ fontSize: "11px", fontWeight: 600, color: "#C4664A", border: "1.5px solid #C4664A", borderRadius: "999px", padding: "3px 10px", background: "none", cursor: "pointer", flexShrink: 0 }}
              >
                {editingTags ? "Done" : "Edit tags"}
              </button>
            </div>

            {/* Inline tag editor */}
            {editingTags && (
              <div style={{ marginBottom: "12px", padding: "12px", backgroundColor: "#FAFAFA", borderRadius: "10px", border: "1px solid rgba(0,0,0,0.08)" }}>
                <p style={{ fontSize: "11px", color: "#999", marginBottom: "8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tap to toggle</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {ALL_CATEGORY_TAGS.map(tag => {
                    const active = tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          padding: "5px 12px",
                          borderRadius: "999px",
                          border: "1.5px solid",
                          borderColor: active ? "#C4664A" : "#D0D0D0",
                          backgroundColor: active ? "#C4664A" : "#fff",
                          color: active ? "#fff" : "#666",
                          cursor: "pointer",
                          transition: "all 0.12s ease",
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dietary tags — only shown for food items */}
            {isFoodItem && (
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                {([{ value: "VG", label: "Vegetarian" }, { value: "VGN", label: "Vegan" }] as { value: string; label: string }[]).map(({ value, label }) => {
                  const isVeg = value === "VG";
                  const active = isVeg
                    ? localTags.includes("VG") || localTags.includes("VGN")
                    : localTags.includes("VGN");
                  return (
                    <button
                      key={value}
                      onClick={() => {
                        if (isVeg) {
                          if (active) {
                            setLocalTags(prev => prev.filter(t => t !== "VG" && t !== "VGN"));
                          } else {
                            setLocalTags(prev => [...prev.filter(t => t !== "VG"), "VG"]);
                          }
                        } else {
                          if (active) {
                            setLocalTags(prev => prev.filter(t => t !== "VGN"));
                          } else {
                            setLocalTags(prev => [...prev.filter(t => t !== "VG" && t !== "VGN"), "VG", "VGN"]);
                          }
                        }
                      }}
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "5px 14px",
                        borderRadius: "999px",
                        border: "1.5px solid",
                        borderColor: active ? "#16a34a" : "#D0D0D0",
                        backgroundColor: active ? "#16a34a" : "#fff",
                        color: active ? "#fff" : "#666",
                        cursor: "pointer",
                        transition: "all 0.12s ease",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            <p style={{ fontSize: "12px", color: "#aaa", marginBottom: "16px" }}>
              {item.sourceMethod === "IN_APP_SAVE" ? "Saved in app" : `Saved from ${SOURCE_LABEL[item.sourcePlatform ?? ""] || SOURCE_LABEL[item.sourceMethod ?? ""] || item.sourceMethod || "URL"}`} · {formatDate(item.savedAt)}
            </p>

            {/* Match reason */}
            <div style={{ background: "#FDF6F3", borderRadius: "12px", padding: "12px 14px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
                <Sparkles size={13} style={{ color: "#C4664A" }} />
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#C4664A" }}>Why this works for your family</span>
              </div>
              <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.5, margin: 0 }}>
                {item.sourcePlatform === "flokk_tours" && notes
                  ? notes
                  : buildMatchReason(tags, interestKeys)}
              </p>
            </div>

            {/* Description */}
            {item.rawDescription && (() => {
              const cleaned = cleanDisplayDescription(item.rawDescription);
              if (cleaned.length < 10) return null;
              return (
                <p style={{ fontSize: "14px", color: "#444", lineHeight: 1.6, marginBottom: "16px" }} suppressHydrationWarning={true}>
                  {cleaned}
                </p>
              );
            })()}

            {/* Visit site + URL edit */}
            <div style={{ marginBottom: "16px" }}>
              {localWebsiteUrl ? (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <a
                    href={localWebsiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "13px", fontWeight: 600, color: "#C4664A", textDecoration: "none" }}
                  >
                    Link →
                  </a>
                  <button
                    type="button"
                    onClick={() => { setUrlInput(localWebsiteUrl); setEditingUrl(true); setUrlError(""); }}
                    style={{ fontSize: "12px", color: "#aaa", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                  >
                    Edit URL
                  </button>
                </div>
              ) : !editingUrl ? (
                <button
                  type="button"
                  onClick={() => { setUrlInput(""); setEditingUrl(true); setUrlError(""); }}
                  style={{ fontSize: "13px", fontWeight: 600, color: "#C4664A", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                >
                  + Add URL
                </button>
              ) : null}
              {editingUrl && (
                <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => { setUrlInput(e.target.value); setUrlError(""); }}
                    placeholder="https://..."
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: `1px solid ${urlError ? "#e53e3e" : "rgba(0,0,0,0.12)"}`, fontSize: "13px", color: "#333", outline: "none", fontFamily: "-apple-system,BlinkMacSystemFont,sans-serif", boxSizing: "border-box" }}
                  />
                  {urlError && <p style={{ fontSize: "12px", color: "#e53e3e", margin: 0 }}>{urlError}</p>}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={async () => {
                        const val = urlInput.trim();
                        if (!val.startsWith("http://") && !val.startsWith("https://")) {
                          setUrlError("Please enter a valid URL");
                          return;
                        }
                        try {
                          await fetch(`/api/saves/${itemId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ websiteUrl: val }),
                          });
                          setLocalWebsiteUrl(val);
                          setEditingUrl(false);
                          setUrlError("");
                        } catch { setUrlError("Failed to save. Try again."); }
                      }}
                      style={{ fontSize: "12px", fontWeight: 700, padding: "5px 14px", borderRadius: "999px", backgroundColor: "#C4664A", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingUrl(false); setUrlError(""); }}
                      style={{ fontSize: "12px", fontWeight: 600, padding: "5px 14px", borderRadius: "999px", backgroundColor: "transparent", color: "#aaa", border: "1px solid #ddd", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Trip assignment */}
            <div onClick={e => e.stopPropagation()} style={{ position: "relative", marginBottom: "16px" }}>
              <button
                onClick={() => setBodyDropdownOpen(o => !o)}
                style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                <span style={{ fontSize: "13px", color: "#555" }}>{assignedTrip ? "Added to trip" : "Add to a trip"}</span>
                {assignedTrip
                  ? <span style={{ fontSize: "13px", fontWeight: 700, color: "#C4664A" }}>{assignedTrip.title} →</span>
                  : <ChevronDown size={13} style={{ color: "#999" }} />
                }
              </button>
              {bodyDropdownOpen && (
                <div style={{ marginTop: "4px", backgroundColor: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", overflow: "hidden", maxHeight: "200px", overflowY: "auto" }}>
                  <button
                    onClick={async () => {
                      setBodyDropdownOpen(false);
                      try {
                        await fetch(`/api/saves/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: null }) });
                        setAssignedTrip(null);
                        onAssigned?.(itemId, { id: "", title: "" });
                      } catch { /* silent */ }
                    }}
                    style={{ width: "100%", padding: "12px 16px", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: "14px", color: "#999", cursor: "pointer", fontWeight: 500 }}
                  >
                    No trip / Keep unassigned
                  </button>
                  {(() => {
                    const { current: currentTrips, upcoming: upcomingTrips, past: pastTrips } = bucketTrips(trips);
                    const renderTripBtn = (trip: Trip) => (
                      <button
                        key={trip.id}
                        onClick={() => handleAssignTrip(trip)}
                        style={{ width: "100%", padding: "12px 16px", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: "14px", color: "#1a1a1a", cursor: "pointer", fontWeight: 500 }}
                      >
                        {trip.title}
                      </button>
                    );
                    return (
                      <>
                        {currentTrips.length > 0 && (
                          <>
                            <p style={{ fontSize: "10px", color: "#C4664A", textTransform: "uppercase", letterSpacing: "0.06em", padding: "6px 16px 2px", fontWeight: 600 }}>Happening Now</p>
                            {currentTrips.map(renderTripBtn)}
                          </>
                        )}
                        {upcomingTrips.length > 0 && (
                          <>
                            <p style={{ fontSize: "10px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", padding: "6px 16px 2px", fontWeight: 600, marginTop: currentTrips.length > 0 ? "4px" : "0" }}>Upcoming</p>
                            {upcomingTrips.map(renderTripBtn)}
                          </>
                        )}
                        {pastTrips.length > 0 && (
                          <>
                            <button
                              onClick={() => setShowPastTrips(v => !v)}
                              style={{ width: "100%", padding: "6px 16px 2px", textAlign: "left", background: "none", border: "none", fontSize: "10px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, cursor: "pointer", marginTop: (currentTrips.length > 0 || upcomingTrips.length > 0) ? "4px" : "0" }}
                            >
                              Past Trips {showPastTrips ? "▲" : "▼"}
                            </button>
                            {showPastTrips && pastTrips.map(renderTripBtn)}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Rating */}
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", marginBottom: "8px" }}>Rate this place</p>
              <div style={{ display: "flex", gap: "4px" }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={async () => {
                      const newRating = userRating === star ? null : star;
                      setUserRating(newRating);
                      try {
                        await fetch(`/api/saves/${itemId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ userRating: newRating }),
                        });
                      } catch { /* silent */ }
                    }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "24px", color: star <= (userRating ?? 0) ? "#C4664A" : "#D0D0D0", padding: "0 2px", lineHeight: 1, fontFamily: "inherit" }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Lodging type — visible only for lodging-tagged saves */}
            {localTags.some(t => /lodg/i.test(t)) && (
              <div style={{ marginBottom: "16px" }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", marginBottom: "8px" }}>Lodging type</p>
                <select
                  value={lodgingType ?? ""}
                  onChange={async (e) => {
                    const val = e.target.value || null;
                    setLodgingType(val);
                    await fetch(`/api/saves/${itemId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ lodgingType: val }),
                    });
                  }}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: "10px",
                    border: "1px solid rgba(0,0,0,0.12)", fontSize: "13px",
                    color: lodgingType ? "#1B3A5C" : "#888", backgroundColor: "#fff",
                    appearance: "none", outline: "none", cursor: "pointer",
                    fontFamily: "-apple-system,BlinkMacSystemFont,sans-serif",
                  }}
                >
                  <option value="">Select type…</option>
                  {LODGING_TYPE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom: "8px" }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", marginBottom: "8px" }}>Your notes</p>
              <div style={{ position: "relative" }}>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onBlur={handleNotesBlur}
                  placeholder="Add your own notes..."
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: "10px",
                    border: "1px solid rgba(0,0,0,0.12)", fontSize: "13px",
                    color: "#333", resize: "none", outline: "none",
                    fontFamily: "-apple-system,BlinkMacSystemFont,sans-serif",
                    lineHeight: 1.5, boxSizing: "border-box",
                  }}
                />
              </div>
              {(noteSaving || noteSaved) && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  marginTop: "6px", fontSize: "13px",
                  color: noteSaving ? "#6B7280" : "#6B8F71",
                  fontFamily: "'DM Sans', sans-serif",
                  transition: "opacity 200ms ease-out",
                }}>
                  {noteSaving ? (
                    <>
                      <span style={{
                        display: "inline-block", width: "12px", height: "12px",
                        border: "2px solid #E5E7EB", borderTopColor: "#6B7280",
                        borderRadius: "50%", animation: "spin 600ms linear infinite"
                      }} />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} strokeWidth={2.5} />
                      <span>Saved</span>
                    </>
                  )}
                </div>
              )}
            </div>

          {/* Start time — only shown when item is assigned to a day */}
          {item.trip && (
            <div style={{ marginBottom: "12px" }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", marginBottom: "8px" }}>Start time</p>
              <input
                type="time"
                value={startTime}
                onChange={async (e) => {
                  const val = e.target.value;
                  setStartTime(val);
                  try {
                    await fetch(`/api/saves/${itemId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ startTime: val || null }),
                    });
                    onTimeSet?.(itemId, val || null);
                  } catch { /* silent */ }
                }}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid rgba(0,0,0,0.12)", fontSize: "14px", color: "#333", outline: "none", fontFamily: "-apple-system,BlinkMacSystemFont,sans-serif", boxSizing: "border-box" }}
              />
              {startTime && (
                <button
                  onClick={async () => {
                    setStartTime("");
                    try {
                      await fetch(`/api/saves/${itemId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ startTime: null }),
                      });
                      onTimeSet?.(itemId, null);
                    } catch { /* silent */ }
                  }}
                  style={{ marginTop: "4px", background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#AAAAAA", padding: 0, fontFamily: "inherit" }}
                >
                  Clear time
                </button>
              )}
            </div>
          )}

          {onRemoveFromDay && (
            <div style={{ marginTop: "4px" }}>
              {confirmRemove ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "8px", backgroundColor: "rgba(229,62,62,0.06)", border: "1px solid rgba(229,62,62,0.2)" }}>
                  <span style={{ fontSize: "12px", color: "#555", flex: 1 }}>Remove from itinerary?</span>
                  <button
                    onClick={() => { onRemoveFromDay(); onClose(); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", fontSize: "12px", color: "#e53e3e", fontWeight: 700, fontFamily: "inherit" }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmRemove(false)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", fontSize: "12px", color: "#999", fontWeight: 500, fontFamily: "inherit" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRemove(true)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", color: "#e53e3e", fontWeight: 500, fontFamily: "inherit" }}
                >
                  Remove from day
                </button>
              )}
            </div>
          )}
        </div>
        )}

        {/* Bottom action row — fixed within modal */}
        {item && (
          <div style={{
            position: "sticky", bottom: 0, backgroundColor: "#fff",
            borderTop: "1px solid rgba(0,0,0,0.08)",
            padding: "12px 20px 24px",
          }}>
            {/* CTAs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Book / Visit site */}
              {item.affiliateUrl ? (
                <a
                  href={item.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                    width: "100%", padding: "13px", borderRadius: "999px", backgroundColor: "#C4664A",
                    fontSize: "14px", fontWeight: 700, color: "#fff", textDecoration: "none",
                  }}
                >
                  <ExternalLink size={14} />
                  Book now
                </a>
              ) : (item.websiteUrl ?? item.sourceUrl) ? (
                <a
                  href={(item.websiteUrl ?? item.sourceUrl)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                    width: "100%", padding: "13px", borderRadius: "999px", backgroundColor: "#1B3A5C",
                    fontSize: "14px", fontWeight: 700, color: "#fff", textDecoration: "none",
                  }}
                >
                  <ExternalLink size={14} />
                  Link →
                </a>
              ) : null}

              {/* Book it — toggleable */}
              {isBooked ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#AAAAAA", fontWeight: 500 }}>Booked</span>
                  <button
                    onClick={async () => {
                      setIsBooked(false);
                      const res = await fetch(`/api/saves/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isBooked: false }) });
                      if (!res.ok) setIsBooked(true);
                    }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#CCCCCC", padding: 0, fontFamily: "inherit" }}
                  >
                    (undo)
                  </button>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    setIsBooked(true);
                    const res = await fetch(`/api/saves/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isBooked: true }) });
                    if (!res.ok) { setIsBooked(false); } else { onMarkedBooked?.(itemId); }
                  }}
                  style={{ width: "100%", padding: "13px", borderRadius: "999px", backgroundColor: "transparent", border: "1.5px solid #C4664A", fontSize: "14px", fontWeight: 700, color: "#C4664A", cursor: "pointer" }}
                >
                  Book it →
                </button>
              )}

              {/* Share */}
              {item && (
                <button
                  onClick={async () => {
                    const result = await shareEntity({ entityType: "saved_item", entityId: item.id });
                    if (result.ok) { setJustShared(true); setTimeout(() => setJustShared(false), 2000); }
                  }}
                  style={{ width: "100%", padding: "13px", borderRadius: "999px", backgroundColor: "transparent", border: "1.5px solid rgba(196,102,74,0.4)", fontSize: "14px", fontWeight: 700, color: justShared ? "#4a7c59" : "#C4664A", cursor: "pointer", fontFamily: "inherit" }}
                >
                  {justShared ? "Link copied" : "Share"}
                </button>
              )}

            </div>

          </div>
        )}
      </div>
    </>
  );
}
