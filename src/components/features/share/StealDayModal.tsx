"use client";

import { useState, useEffect } from "react";
import { X, Plus, FolderPlus, Bookmark, ChevronLeft, Calendar } from "lucide-react";

const NAVY = "#1B3A5C";
const TERRA = "#C4664A";
const GRAY_100 = "#F5F5F5";
const GRAY_200 = "#E5E7EB";
const GRAY_500 = "#6B7280";

export interface StealDayItem {
  id: string;
  title: string;
  destinationCity?: string | null;
  lat?: number | null;
  lng?: number | null;
  imageUrl?: string | null;
  websiteUrl?: string | null;
}

interface UserTrip {
  id: string;
  title: string;
  destinationCity: string | null;
  startDate: string | null;
  endDate: string | null;
}

type Step = "options" | "create-trip" | "add-to-trip" | "add-to-saves" | "success";

interface SuccessData {
  tripId: string | null;
  tripTitle: string;
  copied: number;
  destination: "trip" | "saves";
}

interface Props {
  open: boolean;
  shareToken: string;
  sourceTripId?: string | null;
  day: {
    index: number;       // 1-based from share page
    label: string;       // "Day 1"
    city: string | null;
    items: StealDayItem[];
  };
  onClose: () => void;
  onItemsSaved?: (itemIds: string[]) => void;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "";
  const s = new Date(start.split("T")[0] + "T12:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (!end) return s.toLocaleDateString("en-US", opts);
  const e = new Date(end.split("T")[0] + "T12:00:00");
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function buildSubtitle(items: StealDayItem[]): string {
  const named = items.filter(i => i.title);
  const count = named.length;
  if (count === 0) return "No stops";
  const preview = named.slice(0, 2).map(i => i.title);
  if (count <= 2) return `${count} stop${count > 1 ? "s" : ""}: ${preview.join(" · ")}`;
  return `${count} stops including ${preview.join(" · ")} and ${count - 2} more`;
}

export function StealDayModal({ open, shareToken, sourceTripId, day, onClose, onItemsSaved }: Props) {
  const defaultTripName = `${day.city ?? "Trip"} — ${day.label}`;

  const [step, setStep] = useState<Step>("options");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  // Create-trip fields
  const [tripName, setTripName] = useState(defaultTripName);
  const [startDate, setStartDate] = useState("");

  // Add-to-trip fields
  const [trips, setTrips] = useState<UserTrip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedTripTitle, setSelectedTripTitle] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep("options");
      setError(null);
      setSubmitting(false);
      setSuccessData(null);
      setTripName(defaultTripName);
      setStartDate("");
      setSelectedTripId(null);
      setSelectedTripTitle(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fetch user trips when entering add-to-trip step
  useEffect(() => {
    if (step !== "add-to-trip") return;
    setTripsLoading(true);
    fetch("/api/trips")
      .then(r => r.json())
      .then((d: { trips?: UserTrip[] }) => setTrips(d.trips ?? []))
      .catch(() => setTrips([]))
      .finally(() => setTripsLoading(false));
  }, [step]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().substring(0, 10);

  // ── Action handlers ────────────────────────────────────────────────────────

  async function handleCreateTrip() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/trips/steal-to-new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareToken,
          filterDayIndex: day.index,
          tripName: tripName.trim() || defaultTripName,
          startDate: startDate || undefined,
        }),
      });
      const data = await res.json() as { tripId?: string; tripTitle?: string; copied?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create trip");
      setSuccessData({ tripId: data.tripId ?? null, tripTitle: data.tripTitle ?? tripName, copied: data.copied ?? 0, destination: "trip" });
      setStep("success");
    } catch (e) {
      setError((e as Error).message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddToTrip() {
    if (!selectedTripId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/trips/steal-to-new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareToken, filterDayIndex: day.index, targetTripId: selectedTripId }),
      });
      const data = await res.json() as { tripId?: string; tripTitle?: string; copied?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to add to trip");
      setSuccessData({ tripId: data.tripId ?? null, tripTitle: selectedTripTitle ?? data.tripTitle ?? "your trip", copied: data.copied ?? 0, destination: "trip" });
      setStep("success");
    } catch (e) {
      setError((e as Error).message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddToSaves() {
    setSubmitting(true);
    setError(null);
    const savedIds: string[] = [];
    try {
      for (const item of day.items) {
        if (!item.title) continue;
        const res = await fetch("/api/saves/from-share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            city: item.destinationCity ?? null,
            lat: item.lat ?? null,
            lng: item.lng ?? null,
            placePhotoUrl: item.imageUrl ?? null,
            websiteUrl: item.websiteUrl ?? null,
            dayIndex: day.index - 1,  // 1-based share page → 0-based TripTabContent
            sourceTripId: sourceTripId ?? null,
          }),
        });
        if (res.ok) savedIds.push(item.id);
      }
      onItemsSaved?.(savedIds);
      setSuccessData({ tripId: null, tripTitle: "", copied: savedIds.length, destination: "saves" });
      setStep("success");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Shared styles ──────────────────────────────────────────────────────────

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 1200,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  };

  const sheet: React.CSSProperties = {
    backgroundColor: "#fff",
    borderRadius: "20px 20px 0 0",
    width: "100%", maxWidth: "480px",
    padding: "24px 24px 40px",
    maxHeight: "90vh", overflowY: "auto",
  };

  const primaryBtn = (disabled?: boolean): React.CSSProperties => ({
    width: "100%", padding: "14px",
    borderRadius: "999px", border: "none",
    backgroundColor: TERRA, color: "#fff",
    fontSize: "15px", fontWeight: 700,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontFamily: "inherit", display: "block", textAlign: "center", textDecoration: "none",
  });

  const ghostBtn: React.CSSProperties = {
    width: "100%", padding: "13px",
    borderRadius: "999px", border: `1px solid ${GRAY_200}`,
    backgroundColor: "#fff", color: NAVY,
    fontSize: "14px", fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  };

  const backBtn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "4px",
    background: "none", border: "none", padding: "0 0 16px",
    color: GRAY_500, fontSize: "13px", fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  };

  const inputField: React.CSSProperties = {
    width: "100%", padding: "11px 14px",
    borderRadius: "10px", border: `1px solid ${GRAY_200}`,
    fontSize: "14px", color: "#1a1a1a",
    boxSizing: "border-box", outline: "none", fontFamily: "inherit",
  };

  const fieldLabel: React.CSSProperties = {
    display: "block", fontSize: "12px",
    fontWeight: 600, color: NAVY, marginBottom: "6px",
  };

  // ── Modal header (reused across steps) ────────────────────────────────────

  const ModalHeader = ({ title }: { title: string }) => (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "4px" }}>
        <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: "20px", fontWeight: 700, color: NAVY, margin: 0, lineHeight: 1.2 }}>
          {title}
        </h2>
        <button onClick={onClose} style={{ background: "none", border: "none", padding: "2px", cursor: "pointer", color: "#9CA3AF", marginLeft: "12px" }} aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <p style={{ fontSize: "13px", color: GRAY_500, margin: 0, lineHeight: 1.5 }}>
        {buildSubtitle(day.items)}
      </p>
    </div>
  );

  // ── Step: options ──────────────────────────────────────────────────────────

  if (step === "options") {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={sheet} onClick={e => e.stopPropagation()}>
          <ModalHeader title={`Steal ${day.label}`} />
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
            <OptionCard
              icon={<Plus size={20} color={TERRA} />}
              title="Create a new trip"
              description="Start a fresh trip plan with these stops"
              onClick={() => setStep("create-trip")}
            />
            <OptionCard
              icon={<FolderPlus size={20} color={NAVY} />}
              title="Add to an existing trip"
              description="Append these stops to a trip you already have"
              onClick={() => setStep("add-to-trip")}
            />
            <OptionCard
              icon={<Bookmark size={20} color={GRAY_500} />}
              title="Add to Saves"
              description="Save these stops for later, no trip needed"
              onClick={() => setStep("add-to-saves")}
            />
          </div>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
        </div>
      </div>
    );
  }

  // ── Step: add-to-saves (confirmation) ─────────────────────────────────────

  if (step === "add-to-saves") {
    const saveCount = day.items.filter(i => i.title).length;
    return (
      <div style={overlay} onClick={onClose}>
        <div style={sheet} onClick={e => e.stopPropagation()}>
          <ModalHeader title={`Steal ${day.label}`} />
          <button style={backBtn} onClick={() => { setError(null); setStep("options"); }}>
            <ChevronLeft size={14} /> Back
          </button>
          <p style={{ fontSize: "14px", color: "#444", lineHeight: 1.6, marginBottom: "20px" }}>
            {saveCount} stop{saveCount !== 1 ? "s" : ""} will land in your unorganized saves. You can move them into a trip later.
          </p>
          {error && <p style={{ fontSize: "13px", color: "#EF4444", marginBottom: "12px" }}>{error}</p>}
          <button style={{ ...primaryBtn(submitting), marginBottom: "10px" }} onClick={handleAddToSaves} disabled={submitting}>
            {submitting ? "Saving..." : "Add to saves"}
          </button>
          <button style={ghostBtn} onClick={onClose}>Cancel</button>
        </div>
      </div>
    );
  }

  // ── Step: create-trip ──────────────────────────────────────────────────────

  if (step === "create-trip") {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={sheet} onClick={e => e.stopPropagation()}>
          <ModalHeader title={`Steal ${day.label}`} />
          <button style={backBtn} onClick={() => { setError(null); setStep("options"); }}>
            <ChevronLeft size={14} /> Back
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
            <div>
              <label style={fieldLabel}>Trip name</label>
              <input
                type="text"
                value={tripName}
                onChange={e => setTripName(e.target.value)}
                style={inputField}
                placeholder={defaultTripName}
                autoFocus
              />
            </div>
            <div>
              <label style={fieldLabel}>
                When are you going? <span style={{ color: GRAY_500, fontWeight: 400 }}>(optional)</span>
              </label>
              <div style={{ position: "relative" }}>
                <Calendar size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: GRAY_500, pointerEvents: "none" }} />
                <input
                  type="date"
                  value={startDate}
                  min={tomorrowStr}
                  onChange={e => setStartDate(e.target.value)}
                  style={{ ...inputField, paddingLeft: "34px" }}
                />
              </div>
              <p style={{ fontSize: "12px", color: GRAY_500, margin: "4px 0 0" }}>
                We&apos;ll plot Day 1 to your start date. Skip to set dates later.
              </p>
            </div>
          </div>
          {error && <p style={{ fontSize: "13px", color: "#EF4444", marginBottom: "12px" }}>{error}</p>}
          <button
            style={{ ...primaryBtn(submitting || !tripName.trim()), marginBottom: "10px" }}
            onClick={handleCreateTrip}
            disabled={submitting || !tripName.trim()}
          >
            {submitting ? "Creating trip..." : "Create trip"}
          </button>
          <button style={ghostBtn} onClick={onClose}>Cancel</button>
        </div>
      </div>
    );
  }

  // ── Step: add-to-trip ──────────────────────────────────────────────────────

  if (step === "add-to-trip") {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={sheet} onClick={e => e.stopPropagation()}>
          <ModalHeader title={`Steal ${day.label}`} />
          <button style={backBtn} onClick={() => { setError(null); setSelectedTripId(null); setStep("options"); }}>
            <ChevronLeft size={14} /> Back
          </button>
          <p style={{ fontSize: "13px", fontWeight: 600, color: NAVY, margin: "0 0 12px" }}>Pick a trip</p>

          {tripsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              {[1, 2, 3].map(i => <div key={i} style={{ height: "56px", backgroundColor: GRAY_100, borderRadius: "10px" }} />)}
            </div>
          ) : trips.length === 0 ? (
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontSize: "14px", color: GRAY_500, marginBottom: "16px" }}>
                You don&apos;t have any trips yet. Want to create one?
              </p>
              <button style={{ ...primaryBtn() }} onClick={() => { setError(null); setStep("create-trip"); }}>
                Create a new trip
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              {trips.map(trip => (
                <button
                  key={trip.id}
                  style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "14px", borderRadius: "12px",
                    border: `1px solid ${selectedTripId === trip.id ? TERRA : GRAY_200}`,
                    backgroundColor: selectedTripId === trip.id ? "#FFF3EE" : "#fff",
                    cursor: "pointer", textAlign: "left",
                    width: "100%", fontFamily: "inherit",
                  }}
                  onClick={() => { setSelectedTripId(trip.id); setSelectedTripTitle(trip.title ?? null); }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: NAVY, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {trip.title}
                    </p>
                    <p style={{ fontSize: "12px", color: GRAY_500, margin: "2px 0 0" }}>
                      {[trip.destinationCity, trip.startDate ? formatDateRange(trip.startDate, trip.endDate) : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {selectedTripId === trip.id && (
                    <div style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: TERRA, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ color: "#fff", fontSize: "12px", lineHeight: 1 }}>✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {error && <p style={{ fontSize: "13px", color: "#EF4444", marginBottom: "12px" }}>{error}</p>}
          <button
            style={{ ...primaryBtn(submitting || !selectedTripId), marginBottom: "10px" }}
            onClick={handleAddToTrip}
            disabled={submitting || !selectedTripId}
          >
            {submitting ? "Adding..." : "Add to trip"}
          </button>
          <button style={ghostBtn} onClick={onClose}>Cancel</button>
        </div>
      </div>
    );
  }

  // ── Step: success ──────────────────────────────────────────────────────────

  if (step === "success" && successData) {
    const { tripId, tripTitle, copied, destination } = successData;
    const isSaves = destination === "saves";
    return (
      <div style={overlay} onClick={onClose}>
        <div style={sheet} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
            <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: "20px", fontWeight: 700, color: NAVY, margin: 0 }}>
              {isSaves ? "Saved!" : "Day added!"}
            </h2>
            <button onClick={onClose} style={{ background: "none", border: "none", padding: "2px", cursor: "pointer", color: "#9CA3AF" }}>
              <X size={20} />
            </button>
          </div>
          <p style={{ fontSize: "14px", color: "#444", lineHeight: 1.6, marginBottom: "24px" }}>
            {isSaves
              ? `${copied} stop${copied !== 1 ? "s" : ""} added to your saves.`
              : `${copied} stop${copied !== 1 ? "s" : ""} added to ${tripTitle}.`}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {!isSaves && tripId ? (
              <a href={`/trips/${tripId}`} style={{ ...primaryBtn(), textDecoration: "none" }}>
                View trip →
              </a>
            ) : isSaves ? (
              <a href="/saves" style={{ ...primaryBtn(), textDecoration: "none" }}>
                View saves →
              </a>
            ) : null}
            <button style={ghostBtn} onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── OptionCard sub-component ─────────────────────────────────────────────────

function OptionCard({ icon, title, description, onClick }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      style={{
        display: "flex", alignItems: "center", gap: "16px",
        padding: "16px", borderRadius: "14px",
        border: `1px solid ${hovered ? TERRA : GRAY_200}`,
        backgroundColor: hovered ? "#FFF8F5" : "#fff",
        cursor: "pointer", textAlign: "left",
        width: "100%", fontFamily: "inherit",
        transition: "border-color 0.15s, background-color 0.15s",
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ flexShrink: 0, width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "14px", fontWeight: 700, color: NAVY, margin: 0 }}>{title}</p>
        <p style={{ fontSize: "12px", color: GRAY_500, margin: "2px 0 0", lineHeight: 1.4 }}>{description}</p>
      </div>
    </button>
  );
}
