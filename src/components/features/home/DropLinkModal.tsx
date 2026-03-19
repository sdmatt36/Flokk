"use client";

import { useState, useRef, useEffect } from "react";
import { MapPin, X } from "lucide-react";

type Trip = { id: string; title: string; startDate: string | null; endDate: string | null };

type ExtractedCard = {
  title: string;
  location: string;
  tags: string[];
  img: string;
  source: string;
  description: string;
  lat?: number;
  lng?: number;
};

const SAVE_LATER = "__later__";

function generateDayPills(startDate: string | null, endDate: string | null): { dayIndex: number; label: string }[] {
  if (!startDate) return [];
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return [];
  const end = endDate ? new Date(endDate) : start;
  const numDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  return Array.from({ length: numDays }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { dayIndex: i + 1, label: `Day ${i + 1} · ${dateStr}` };
  });
}

const CATEGORY_OPTIONS = ["Culture", "Food", "Kids", "Lodging", "Outdoor", "Shopping", "Transportation"];

export function DropLinkModal({
  trips,
  onClose,
  onSaved,
  initialTripId,
  lockedTripId,
}: {
  trips: Trip[];
  onClose: () => void;
  onSaved: (tripTitle: string | null) => void;
  initialTripId?: string;
  lockedTripId?: string;
}) {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedCard | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [selectedId, setSelectedId] = useState<string>(
    lockedTripId ?? initialTripId ?? trips[0]?.id ?? SAVE_LATER
  );
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [checkinDate, setCheckinDate] = useState<string>("");
  const [checkoutDate, setCheckoutDate] = useState<string>("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Auto-trigger extraction 700ms after a valid URL is pasted/typed
  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed || !/^https?:\/\//.test(trimmed)) return;
    const timer = setTimeout(async () => {
      console.log("[modal] calling /api/extract for:", trimmed);
      setUrlError("");
      setIsExtracting(true);
      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });
        const data = res.ok ? await res.json() : {};
        console.log("[modal] extraction result:", data);
        const safeImage =
          data.image &&
          typeof data.image === "string" &&
          data.image.startsWith("http") &&
          !data.image.includes("{")
            ? data.image
            : "";
        const card: ExtractedCard = {
          title: data.title ?? "",
          location: "",
          tags: data.category ? [data.category] : [],
          img: safeImage,
          source: data.platformLabel ?? "Web",
          description: data.description ?? "",
        };
        setExtracted(card);
        setEditedTitle(card.title);
        setSelectedCategory(data.category ?? "");
        if (data.checkin) setCheckinDate(data.checkin);
        if (data.checkout) setCheckoutDate(data.checkout);
        if (!data.checkin && !data.checkout) {
          try {
            const parsed = new URL(trimmed);
            const ci =
              parsed.searchParams.get("check_in") ??
              parsed.searchParams.get("checkin") ??
              parsed.searchParams.get("arrival") ??
              "";
            const co =
              parsed.searchParams.get("check_out") ??
              parsed.searchParams.get("checkout") ??
              parsed.searchParams.get("departure") ??
              "";
            if (ci) setCheckinDate(ci);
            if (co) setCheckoutDate(co);
          } catch { /* ignore */ }
        }
      } catch (err) {
        console.error("[modal] extraction failed:", err);
        setUrlError("Couldn't load link details. Check the URL and try again.");
      } finally {
        setIsExtracting(false);
      }
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  function animateClose(cb?: () => void) {
    setVisible(false);
    setTimeout(() => {
      onClose();
      cb?.();
    }, 220);
  }

  async function handleSave() {
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError("Please paste a link first.");
      return;
    }
    if (isExtracting) return;
    setSaving(true);
    const effectiveId = lockedTripId ?? selectedId;
    const isLater = effectiveId === SAVE_LATER;
    const tripTitle = isLater ? null : (trips.find((t) => t.id === effectiveId)?.title ?? null);

    try {
      const res = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmed,
          tripId: isLater ? undefined : effectiveId,
          title: editedTitle || extracted?.title || trimmed,
          description: extracted?.description ?? "",
          thumbnailUrl: extracted?.img || undefined,
          tags: selectedCategory ? [selectedCategory] : (extracted?.tags ?? []),
          lat: extracted?.lat,
          lng: extracted?.lng,
          dayIndex: selectedDayIndex ?? undefined,
          extractedCheckin: isLodging && checkinDate ? checkinDate : undefined,
          extractedCheckout: isLodging && checkoutDate ? checkoutDate : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("Save failed:", res.status, body);
        setSaving(false);
        return;
      }

      onSaved(tripTitle);
      animateClose(() => {
        window.dispatchEvent(new Event("flokk:refresh"));
      });
    } catch (err) {
      console.error("Save error:", err);
      setSaving(false);
    }
  }

  const effectiveId = lockedTripId ?? selectedId;
  const urlLower = url.toLowerCase();
  const isLodging =
    /airbnb\.com|booking\.com|hotels\.com|vrbo\.com/.test(urlLower) ||
    extracted?.source === "Airbnb" ||
    extracted?.source === "Booking.com" ||
    extracted?.source === "Hotels.com" ||
    extracted?.source === "Expedia" ||
    extracted?.tags?.includes("Lodging") ||
    selectedCategory === "Lodging" ||
    selectedCategory?.toLowerCase().includes("lodg") ||
    selectedCategory?.toLowerCase().includes("hotel");

  const selectedTrip = trips.find((t) => t.id === effectiveId);
  const hasUrl = url.trim().length > 0;
  const ctaLabel = saving
    ? "Saving..."
    : isExtracting
      ? "Loading..."
      : !hasUrl
        ? "Paste a link above →"
        : effectiveId === SAVE_LATER
          ? "Save for later →"
          : selectedDayIndex !== null
            ? `Save to Day ${selectedDayIndex} · ${selectedTrip?.title ?? ""} →`
            : `Save to ${selectedTrip?.title ?? ""} →`;

  return (
    <div
      className="flex items-end md:items-center md:justify-center md:p-4"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.45)",
        zIndex: 200,
        display: "flex",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.22s ease",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) animateClose(); }}
    >
      <div
        className="w-full md:max-w-[520px] rounded-t-[20px] md:rounded-[20px]"
        style={{
          backgroundColor: "#fff",
          maxHeight: "calc(100vh - 60px)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 4px 32px rgba(0,0,0,0.12)",
          overflow: "hidden",
          transform: visible ? "translateY(0)" : "translateY(24px)",
          transition: "transform 0.22s ease, opacity 0.22s ease",
          opacity: visible ? 1 : 0,
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "24px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2 }}>
                Drop a link
              </p>
              <p style={{ fontSize: "14px", color: "#717171", marginTop: "4px" }}>
                {lockedTripId
                  ? `Saving to: ${selectedTrip?.title ?? "this trip"}`
                  : "Paste anything — Instagram, TikTok, Google Maps, Airbnb, anywhere."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => animateClose()}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#999", flexShrink: 0, marginLeft: "16px" }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable body — single screen */}
        <div style={{ padding: "20px 24px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* URL input */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setUrlError("");
                if (!e.target.value.trim()) {
                  setExtracted(null);
                  setIsExtracting(false);
                }
              }}
              placeholder="Paste a link..."
              autoFocus
              style={{
                width: "100%",
                padding: "14px 16px",
                fontSize: "15px",
                border: urlError ? "1.5px solid #e53e3e" : "1.5px solid #E0E0E0",
                borderRadius: "12px",
                outline: "none",
                color: "#1a1a1a",
                backgroundColor: "#FAFAFA",
                boxSizing: "border-box",
              }}
            />
            {urlError && (
              <p style={{ fontSize: "13px", color: "#e53e3e" }}>{urlError}</p>
            )}
          </div>

          {/* Inline spinner while extracting */}
          {isExtracting && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0" }}>
              <div style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                border: "2.5px solid #EEEEEE",
                borderTopColor: "#C4664A",
                animation: "droplinkSpin 0.8s linear infinite",
                flexShrink: 0,
              }} />
              <p style={{ fontSize: "13px", color: "#717171" }}>Pulling out the details...</p>
              <style>{`@keyframes droplinkSpin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Extracted preview card — populates inline after extraction */}
          {extracted && !isExtracting && (
            <div style={{ border: "1px solid #EEEEEE", borderRadius: "14px", overflow: "hidden" }}>
              {extracted.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={extracted.img}
                  alt={extracted.title}
                  style={{ width: "100%", height: "160px", objectFit: "cover", display: "block" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div style={{ height: "60px", backgroundColor: "#F5F0EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "12px", color: "#aaa" }}>{extracted.source}</span>
                </div>
              )}
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{
                  alignSelf: "flex-start",
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: "rgba(196,102,74,0.1)",
                  color: "#C4664A",
                  borderRadius: "20px",
                  padding: "3px 10px",
                }}>
                  {extracted.source}
                </span>

                {/* Editable title */}
                {editingTitle ? (
                  <input
                    ref={titleInputRef}
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
                    autoFocus
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "#1a1a1a",
                      border: "none",
                      borderBottom: "1.5px solid #C4664A",
                      outline: "none",
                      background: "transparent",
                      width: "100%",
                      padding: "2px 0",
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditingTitle(true); setTimeout(() => titleInputRef.current?.select(), 10); }}
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "#1a1a1a",
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "text",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    {editedTitle || extracted.title || url}
                    <span style={{ fontSize: "11px", color: "#C4664A", marginLeft: "6px", fontWeight: 500 }}>edit</span>
                  </button>
                )}

                {extracted.location && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <MapPin size={12} style={{ color: "#C4664A", flexShrink: 0 }} />
                    <span style={{ fontSize: "13px", color: "#717171" }}>{extracted.location}</span>
                  </div>
                )}

                {extracted.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {extracted.tags.map((tag) => (
                      <span key={tag} style={{ fontSize: "11px", backgroundColor: "rgba(0,0,0,0.05)", color: "#666", borderRadius: "20px", padding: "3px 10px" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Trip assignment — hidden when lockedTripId is set */}
          {lockedTripId ? (
            <div style={{ padding: "10px 14px", backgroundColor: "rgba(196,102,74,0.06)", borderRadius: "10px", border: "1px solid rgba(196,102,74,0.15)" }}>
              <p style={{ fontSize: "13px", color: "#717171" }}>
                Saving to: <strong style={{ color: "#1a1a1a" }}>{selectedTrip?.title ?? "this trip"}</strong>
              </p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "10px" }}>
                Which trip is this for?
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {trips.map((trip) => {
                  const active = selectedId === trip.id;
                  const pulsing = pulseId === trip.id;
                  return (
                    <button
                      type="button"
                      key={trip.id}
                      onClick={() => {
                        if (active) {
                          setPulseId(trip.id);
                          setTimeout(() => setPulseId(null), 200);
                        } else {
                          setSelectedId(trip.id);
                          setSelectedDayIndex(null);
                        }
                      }}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "999px",
                        fontSize: "13px",
                        fontWeight: 600,
                        border: "1.5px solid",
                        borderColor: active ? "#C4664A" : "#E0E0E0",
                        backgroundColor: active ? "#C4664A" : "#fff",
                        color: active ? "#fff" : "#555",
                        cursor: "pointer",
                        transition: pulsing ? "box-shadow 0s" : "box-shadow 0.3s ease-out, background-color 0.15s, border-color 0.15s",
                        boxShadow: pulsing ? "0 0 0 4px rgba(196,102,74,0.45)" : "0 0 0 0px rgba(196,102,74,0)",
                      }}
                    >
                      {trip.title}
                    </button>
                  );
                })}
                {/* Save for later */}
                {(() => {
                  const active = selectedId === SAVE_LATER;
                  const pulsing = pulseId === SAVE_LATER;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (active) {
                          setPulseId(SAVE_LATER);
                          setTimeout(() => setPulseId(null), 200);
                        } else {
                          setSelectedId(SAVE_LATER);
                        }
                      }}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "999px",
                        fontSize: "13px",
                        fontWeight: 600,
                        border: "1.5px solid",
                        borderColor: active ? "#C4664A" : "#E0E0E0",
                        backgroundColor: active ? "#C4664A" : "#fff",
                        color: active ? "#fff" : "#555",
                        cursor: "pointer",
                        transition: pulsing ? "box-shadow 0s" : "box-shadow 0.3s ease-out, background-color 0.15s, border-color 0.15s",
                        boxShadow: pulsing ? "0 0 0 4px rgba(196,102,74,0.45)" : "0 0 0 0px rgba(196,102,74,0)",
                      }}
                    >
                      Save for later
                    </button>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Lodging: check-in / check-out */}
          {isLodging && (
            <div>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "10px" }}>
                Check-in &amp; check-out
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#717171", display: "block", marginBottom: "4px" }}>Check-in</label>
                  <input
                    type="date"
                    value={checkinDate}
                    onChange={(e) => setCheckinDate(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "10px", border: "1.5px solid #E0E0E0", fontSize: "14px", color: "#1a1a1a", backgroundColor: "#FAFAFA", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#717171", display: "block", marginBottom: "4px" }}>Check-out</label>
                  <input
                    type="date"
                    value={checkoutDate}
                    onChange={(e) => setCheckoutDate(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "10px", border: "1.5px solid #E0E0E0", fontSize: "14px", color: "#1a1a1a", backgroundColor: "#FAFAFA", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Day selection — non-lodging, trip selected, trip has dates */}
          {!isLodging && effectiveId !== SAVE_LATER && (() => {
            const trip = trips.find(t => t.id === effectiveId);
            const dayPills = trip ? generateDayPills(trip.startDate, trip.endDate) : [];
            if (dayPills.length === 0) return null;
            return (
              <div>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "10px" }}>
                  Which day?
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedDayIndex(null)}
                    style={{
                      padding: "7px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 600,
                      border: "1.5px solid",
                      borderColor: selectedDayIndex === null ? "#C4664A" : "#E0E0E0",
                      backgroundColor: selectedDayIndex === null ? "#C4664A" : "#fff",
                      color: selectedDayIndex === null ? "#fff" : "#555",
                      cursor: "pointer",
                    }}
                  >
                    No specific day
                  </button>
                  {dayPills.map(({ dayIndex, label }) => (
                    <button
                      type="button"
                      key={dayIndex}
                      onClick={() => setSelectedDayIndex(dayIndex)}
                      style={{
                        padding: "7px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 600,
                        border: "1.5px solid",
                        borderColor: selectedDayIndex === dayIndex ? "#C4664A" : "#E0E0E0",
                        backgroundColor: selectedDayIndex === dayIndex ? "#C4664A" : "#fff",
                        color: selectedDayIndex === dayIndex ? "#fff" : "#555",
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Category */}
          <div>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "10px" }}>
              Category
            </p>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: "10px",
                border: "1.5px solid #E0E0E0", fontSize: "14px", color: "#1a1a1a",
                backgroundColor: "#FAFAFA", outline: "none", cursor: "pointer",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23717171' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 14px center",
              }}
            >
              <option value="">No category</option>
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Save CTA — always visible, disabled while extracting or no URL */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isExtracting || !hasUrl}
            style={{
              width: "100%",
              padding: "14px",
              backgroundColor: saving || isExtracting || !hasUrl ? "#e0a090" : "#C4664A",
              color: "#fff",
              fontWeight: 700,
              fontSize: "15px",
              border: "none",
              borderRadius: "12px",
              cursor: saving || isExtracting || !hasUrl ? "not-allowed" : "pointer",
              transition: "background-color 0.15s",
            }}
          >
            {ctaLabel}
          </button>

        </div>
      </div>
    </div>
  );
}
