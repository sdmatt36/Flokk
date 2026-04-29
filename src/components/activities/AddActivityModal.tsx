"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { MODAL_OVERLAY_CLASSES, MODAL_PANEL_CLASSES } from "@/lib/modal-classes";
import { CATEGORIES } from "@/lib/categories";

type ActivityStatus = "interested" | "confirmed" | "booked";

export type ExistingActivity = {
  id: string;
  title: string;
  date: string;
  time?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  website?: string | null;
  price?: number | null;
  currency?: string | null;
  notes?: string | null;
  status: string;
  confirmationCode?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type PlacesSuggestion = {
  name: string;
  address: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  photoUrl: string | null;
};

interface Props {
  tripId: string;
  onClose: () => void;
  onSaved: (updated?: ExistingActivity) => void;
  existingActivity?: ExistingActivity;
  defaultDate?: string;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  isSavedItem?: boolean;
}

const STATUS_OPTIONS: { value: ActivityStatus; label: string }[] = [
  { value: "interested", label: "Interested" },
  { value: "confirmed", label: "Confirmed" },
  { value: "booked", label: "Booked" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1.5px solid #E8E8E8",
  borderRadius: "12px",
  padding: "11px 14px",
  fontSize: "14px",
  color: "#1a1a1a",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  backgroundColor: "#fff",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  color: "#717171",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: "6px",
  display: "block",
};

export function AddActivityModal({ tripId, onClose, onSaved, existingActivity, defaultDate, destinationCity, destinationCountry, isSavedItem }: Props) {
  const isEditing = !!(existingActivity?.id);
  const [title, setTitle] = useState(existingActivity?.title ?? "");
  const [date, setDate] = useState(existingActivity?.date ?? defaultDate ?? "");
  const [time, setTime] = useState(existingActivity?.time ?? "");
  const [endTime, setEndTime] = useState(existingActivity?.endTime ?? "");
  const [venueName, setVenueName] = useState(existingActivity?.venueName ?? "");
  const [website, setWebsite] = useState(existingActivity?.website ?? "");
  const [price, setPrice] = useState(existingActivity?.price != null ? String(existingActivity.price) : "");
  const [notes, setNotes] = useState(existingActivity?.notes ?? "");
  const [status, setStatus] = useState<ActivityStatus>((existingActivity?.status as ActivityStatus) ?? "interested");
  const [confirmationCode, setConfirmationCode] = useState(existingActivity?.confirmationCode ?? "");
  const [address, setAddress] = useState(existingActivity?.address ?? "");
  const [currency, setCurrency] = useState(existingActivity?.currency ?? "USD");
  const [showMore, setShowMore] = useState(
    !!(existingActivity?.endTime || existingActivity?.price != null || existingActivity?.confirmationCode || existingActivity?.notes)
  );

  // Pre-select the trip's budget currency (e.g. KRW for Seoul trips)
  useEffect(() => {
    if (existingActivity?.currency) return;
    fetch(`/api/trips/${tripId}/budget`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { budgetCurrency?: string } | null) => { if (d?.budgetCurrency) setCurrency(d.budgetCurrency); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [lat, setLat] = useState<number | null>(existingActivity?.lat ?? null);
  const [lng, setLng] = useState<number | null>(existingActivity?.lng ?? null);
  const [addressFromPlaces, setAddressFromPlaces] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<PlacesSuggestion | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canSave = title.trim() !== "" && (isSavedItem || date !== "") && (isEditing || isSavedItem || !!category);

  async function handleSave() {
    if (!canSave) {
      setError("Activity name and date are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (isSavedItem && existingActivity?.id) {
        const res = await fetch(`/api/saves/${existingActivity.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawTitle: title.trim(),
            notes: notes.trim() || null,
            websiteUrl: website.trim() || null,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          setError(d.error ?? "Failed to save");
          return;
        }
        onSaved();
        return;
      }

      const payload = {
        title: title.trim(),
        date,
        time: time || null,
        endTime: endTime || null,
        venueName: venueName.trim() || null,
        address: address.trim() || null,
        website: website.trim() || null,
        price: price || null,
        currency: currency || "USD",
        notes: notes.trim() || null,
        status,
        confirmationCode: confirmationCode.trim() || null,
        lat: lat ?? null,
        lng: lng ?? null,
        type: category || undefined,
      };

      const url = isEditing
        ? `/api/trips/${tripId}/activities/${existingActivity!.id}`
        : `/api/trips/${tripId}/activities`;

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to save activity");
        return;
      }

      const saved = await res.json();
      onSaved(saved);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      onClick={onClose}
      className={MODAL_OVERLAY_CLASSES}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`${MODAL_PANEL_CLASSES} sm:w-[540px]`}
        style={{ padding: "24px 20px 40px" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <p style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a" }}>{isEditing ? "Edit activity" : "Add an activity"}</p>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#717171", padding: "4px", lineHeight: 1 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Status selector */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
          {STATUS_OPTIONS.map(opt => {
            const active = status === opt.value;
            const isBooked = opt.value === "booked";
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: "12px",
                  border: "1.5px solid",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  borderColor: active ? (isBooked ? "#6B8F71" : "#1B3A5C") : "#E8E8E8",
                  backgroundColor: active ? (isBooked ? "#6B8F71" : "#1B3A5C") : "#fff",
                  color: active ? "#fff" : "#717171",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Form fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Title — required */}
          <div>
            <label style={labelStyle}>Activity *</label>
            <input
              type="text"
              value={title}
              onChange={e => {
                const v = e.target.value;
                setTitle(v);
                setSuggestion(null);
                if (debounceRef.current) clearTimeout(debounceRef.current);
                if (!isEditing && v.trim().length >= 3) {
                  debounceRef.current = setTimeout(async () => {
                    setSuggestionLoading(true);
                    try {
                      const r = await fetch("/api/places-suggest", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ query: v.trim(), city: destinationCity, country: destinationCountry }),
                      });
                      const d = await r.json() as PlacesSuggestion | null;
                      if (d) {
                        setSuggestion(d);
                      }
                    } catch { /* ignore */ } finally {
                      setSuggestionLoading(false);
                    }
                  }, 500);
                } else {
                  setSuggestionLoading(false);
                }
              }}
              placeholder="e.g. Lotte Giants baseball game"
              style={inputStyle}
              autoFocus
            />
            {/* Places suggestion strip */}
            {(suggestionLoading || suggestion) && (
              <div style={{ marginTop: "8px" }}>
                {suggestionLoading && (
                  <p style={{ fontSize: "12px", color: "#999", padding: "8px 12px" }}>Looking up place...</p>
                )}
                {suggestion && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", backgroundColor: "#F9F9F9", borderRadius: "10px", border: "1px solid #E8E8E8" }}>
                    {suggestion.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={suggestion.photoUrl} alt="" style={{ width: "40px", height: "40px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", marginBottom: "1px" }}>{suggestion.name}</p>
                      {suggestion.address && (
                        <p style={{ fontSize: "11px", color: "#717171", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{suggestion.address}</p>
                      )}
                    </div>
                    <span style={{ fontSize: "11px", color: "#888", flexShrink: 0 }}>Is this right?</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (suggestion.name && !venueName) setVenueName(suggestion.name);
                        if (suggestion.address && !address) { setAddress(suggestion.address); setAddressFromPlaces(true); }
                        if (suggestion.website && !website) setWebsite(suggestion.website);
                        if (suggestion.lat != null) setLat(suggestion.lat);
                        if (suggestion.lng != null) setLng(suggestion.lng);
                        setSuggestion(null);
                      }}
                      style={{ fontSize: "12px", fontWeight: 700, color: "#4a7c59", background: "rgba(74,124,89,0.1)", border: "none", cursor: "pointer", padding: "4px 10px", borderRadius: "6px", flexShrink: 0 }}
                    >
                      Yes ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSuggestion(null); }}
                      style={{ fontSize: "12px", fontWeight: 700, color: "#717171", background: "none", border: "none", cursor: "pointer", padding: "4px 6px", flexShrink: 0 }}
                    >
                      No ✗
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Category pills — new activities only */}
          {!isSavedItem && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6, display: "block" }}>
                Category *
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => setCategory(c.slug)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      border: category === c.slug ? "1px solid #C4664A" : "1px solid #E5E7EB",
                      background: category === c.slug ? "#C4664A" : "white",
                      color: category === c.slug ? "white" : "#1B3A5C",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date + Start time */}
          <div style={{ display: "grid", gridTemplateColumns: (existingActivity?.date || defaultDate) ? "1fr" : "1fr 1fr", gap: "10px" }}>
            {!(existingActivity?.date || defaultDate) && (
              <div>
                <label style={labelStyle}>Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}
            <div>
              <label style={labelStyle}>Start time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Venue */}
          <div>
            <label style={labelStyle}>Venue (optional)</label>
            <input
              type="text"
              value={venueName}
              onChange={e => setVenueName(e.target.value)}
              placeholder="e.g. Jamsil Baseball Stadium"
              style={inputStyle}
            />
          </div>

          {/* Address */}
          <div>
            <label style={labelStyle}>Address (optional)</label>
            <input
              type="text"
              value={address}
              onChange={e => { setAddress(e.target.value); setAddressFromPlaces(false); }}
              placeholder="e.g. 123 Bukchon-ro, Jongno-gu, Seoul"
              style={inputStyle}
            />
            {addressFromPlaces && (
              <p style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>From Google Places — edit if needed</p>
            )}
          </div>

          {/* Website */}
          <div>
            <label style={labelStyle}>Website / ticket link (optional)</label>
            <input
              type="url"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://..."
              style={inputStyle}
            />
          </div>

          {/* More details toggle */}
          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#717171", fontWeight: 600, textAlign: "left", padding: 0, fontFamily: "inherit" }}
          >
            {showMore ? "− Less details" : "+ Price, end time, confirmation code, notes"}
          </button>

          {showMore && (
            <>
              {/* Cost + End time */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Cost (optional)</label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <select
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                      style={{ ...inputStyle, width: "74px", flexShrink: 0, padding: "11px 6px", cursor: "pointer" }}
                    >
                      {["USD","KRW","JPY","EUR","GBP","AUD","SGD","HKD","THB","VND","CNY","CAD"].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="e.g. 25000 or 45.00"
                      min="0"
                      step="0.01"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>End time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Confirmation code */}
              <div>
                <label style={labelStyle}>Confirmation code</label>
                <input
                  type="text"
                  value={confirmationCode}
                  onChange={e => setConfirmationCode(e.target.value)}
                  placeholder="e.g. ABC123"
                  style={{ ...inputStyle, fontFamily: "monospace" }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Anything else to remember..."
                  rows={3}
                  style={{ ...inputStyle, resize: "none" }}
                />
              </div>
            </>
          )}

          {error && (
            <p style={{ fontSize: "13px", color: "#C4664A", fontWeight: 600 }}>{error}</p>
          )}

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "14px",
              border: "none",
              backgroundColor: canSave && !saving ? "#1B3A5C" : "#E0E0E0",
              color: canSave && !saving ? "#fff" : "#aaa",
              fontSize: "15px",
              fontWeight: 700,
              cursor: canSave && !saving ? "pointer" : "default",
              fontFamily: "inherit",
            }}
          >
            {saving ? "Saving..." : isEditing ? "Save changes →" : "Save activity →"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
