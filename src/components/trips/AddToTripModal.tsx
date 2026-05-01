"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { MODAL_OVERLAY_CLASSES, MODAL_PANEL_CLASSES } from "@/lib/modal-classes";
import { CATEGORIES } from "@/lib/categories";

type ItemType = "activity" | "lodging";
type Status = "interested" | "confirmed" | "booked";

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "interested", label: "Interested" },
  { value: "confirmed", label: "Confirmed" },
  { value: "booked", label: "Booked" },
];

const CURRENCIES = ["USD", "KRW", "JPY", "EUR", "GBP", "AUD", "SGD", "HKD", "THB", "VND", "CNY", "CAD"];

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
  defaultDate?: string;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  onClose: () => void;
  onSaved: (result: unknown) => void;
}

export function AddToTripModal({
  tripId,
  defaultDate,
  destinationCity,
  destinationCountry,
  onClose,
  onSaved,
}: Props) {
  const [itemType, setItemType] = useState<ItemType>("activity");

  // Shared
  const [status, setStatus] = useState<Status>("interested");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Activity state
  const [actTitle, setActTitle] = useState("");
  const [actDate, setActDate] = useState(defaultDate ?? "");
  const [actTime, setActTime] = useState("");
  const [actEndTime, setActEndTime] = useState("");
  const [actVenue, setActVenue] = useState("");
  const [actAddress, setActAddress] = useState("");
  const [actAddressFromPlaces, setActAddressFromPlaces] = useState(false);
  const [actWebsite, setActWebsite] = useState("");
  const [actPrice, setActPrice] = useState("");
  const [actCurrency, setActCurrency] = useState("USD");
  const [actNotes, setActNotes] = useState("");
  const [actConfCode, setActConfCode] = useState("");
  const [actLat, setActLat] = useState<number | null>(null);
  const [actLng, setActLng] = useState<number | null>(null);
  const [actCategory, setActCategory] = useState("");
  const [actShowMore, setActShowMore] = useState(false);
  const [suggestion, setSuggestion] = useState<PlacesSuggestion | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lodging state
  const [lodgName, setLodgName] = useState("");
  const [lodgCheckInDate, setLodgCheckInDate] = useState(defaultDate ?? "");
  const [lodgCheckInTime, setLodgCheckInTime] = useState("15:00");
  const [lodgCheckOutDate, setLodgCheckOutDate] = useState("");
  const [lodgCheckOutTime, setLodgCheckOutTime] = useState("11:00");
  const [lodgAddress, setLodgAddress] = useState("");
  const [lodgConfCode, setLodgConfCode] = useState("");
  const [lodgCost, setLodgCost] = useState("");
  const [lodgCurrency, setLodgCurrency] = useState("USD");
  const [lodgNotes, setLodgNotes] = useState("");

  // Pre-select budget currency
  useEffect(() => {
    fetch(`/api/trips/${tripId}/budget`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { budgetCurrency?: string } | null) => {
        if (d?.budgetCurrency) {
          setActCurrency(d.budgetCurrency);
          setLodgCurrency(d.budgetCurrency);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch type resets error
  function switchType(t: ItemType) {
    setItemType(t);
    setError("");
  }

  const actCanSave = actTitle.trim() !== "" && (defaultDate ? true : actDate !== "") && actCategory !== "";
  const lodgCanSave = lodgName.trim() !== "" && lodgCheckInDate !== "" && lodgCheckOutDate !== "";

  async function saveActivity() {
    if (!actCanSave) { setError("Activity name, date, and category are required."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/trips/${tripId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: actTitle.trim(),
          date: actDate || defaultDate,
          time: actTime || null,
          endTime: actEndTime || null,
          venueName: actVenue.trim() || null,
          address: actAddress.trim() || null,
          website: actWebsite.trim() || null,
          price: actPrice || null,
          currency: actCurrency || "USD",
          notes: actNotes.trim() || null,
          status,
          confirmationCode: actConfCode.trim() || null,
          lat: actLat ?? null,
          lng: actLng ?? null,
          type: actCategory || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to save activity"); return; }
      onSaved(await res.json());
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveLodging() {
    if (!lodgCanSave) { setError("Property name, check-in date, and check-out date are required."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "LODGING",
          propertyName: lodgName.trim(),
          checkInDate: lodgCheckInDate,
          checkOutDate: lodgCheckOutDate,
          checkInTime: lodgCheckInTime || undefined,
          checkOutTime: lodgCheckOutTime || undefined,
          address: lodgAddress.trim() || undefined,
          confirmationCode: lodgConfCode.trim() || undefined,
          totalCost: lodgCost ? parseFloat(lodgCost) : undefined,
          currency: lodgCurrency || undefined,
          notes: lodgNotes.trim() || undefined,
          status: status.toUpperCase(),
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to save lodging"); return; }
      onSaved(await res.json());
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const canSave = itemType === "activity" ? actCanSave : lodgCanSave;

  return createPortal(
    <div onClick={onClose} className={MODAL_OVERLAY_CLASSES}>
      <div
        onClick={e => e.stopPropagation()}
        className={`${MODAL_PANEL_CLASSES} sm:w-[540px]`}
        style={{ padding: "24px 20px 40px" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <p style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a" }}>Add to day</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#717171", padding: "4px", lineHeight: 1 }}>
            <X size={20} />
          </button>
        </div>

        {/* Type picker */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
          {(["activity", "lodging"] as ItemType[]).map(t => {
            const active = itemType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => switchType(t)}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: "12px",
                  border: "1.5px solid",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  borderColor: active ? "#1B3A5C" : "#E8E8E8",
                  backgroundColor: active ? "#1B3A5C" : "#fff",
                  color: active ? "#fff" : "#717171",
                }}
              >
                {t === "activity" ? "Activity" : "Lodging"}
              </button>
            );
          })}
        </div>

        {/* Status picker */}
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
                  fontFamily: "inherit",
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

          {/* ── ACTIVITY FORM ── */}
          {itemType === "activity" && (
            <>
              <div>
                <label style={labelStyle}>Activity *</label>
                <input
                  type="text"
                  value={actTitle}
                  onChange={e => {
                    const v = e.target.value;
                    setActTitle(v);
                    setSuggestion(null);
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    if (v.trim().length >= 3) {
                      debounceRef.current = setTimeout(async () => {
                        setSuggestionLoading(true);
                        try {
                          const r = await fetch("/api/places-suggest", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ query: v.trim(), city: destinationCity, country: destinationCountry }),
                          });
                          const d = await r.json() as PlacesSuggestion | null;
                          if (d) setSuggestion(d);
                        } catch { /* ignore */ } finally { setSuggestionLoading(false); }
                      }, 500);
                    } else {
                      setSuggestionLoading(false);
                    }
                  }}
                  placeholder="e.g. Lotte Giants baseball game"
                  style={inputStyle}
                  autoFocus
                />
                {(suggestionLoading || suggestion) && (
                  <div style={{ marginTop: "8px" }}>
                    {suggestionLoading && <p style={{ fontSize: "12px", color: "#999", padding: "8px 12px" }}>Looking up place...</p>}
                    {suggestion && (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", backgroundColor: "#F9F9F9", borderRadius: "10px", border: "1px solid #E8E8E8" }}>
                        {suggestion.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={suggestion.photoUrl} alt="" style={{ width: "40px", height: "40px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", marginBottom: "1px" }}>{suggestion.name}</p>
                          {suggestion.address && <p style={{ fontSize: "11px", color: "#717171", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{suggestion.address}</p>}
                        </div>
                        <span style={{ fontSize: "11px", color: "#888", flexShrink: 0 }}>Is this right?</span>
                        <button type="button" onClick={() => {
                          if (suggestion.name && !actVenue) setActVenue(suggestion.name);
                          if (suggestion.address && !actAddress) { setActAddress(suggestion.address); setActAddressFromPlaces(true); }
                          if (suggestion.website && !actWebsite) setActWebsite(suggestion.website);
                          if (suggestion.lat != null) setActLat(suggestion.lat);
                          if (suggestion.lng != null) setActLng(suggestion.lng);
                          setSuggestion(null);
                        }} style={{ fontSize: "12px", fontWeight: 700, color: "#4a7c59", background: "rgba(74,124,89,0.1)", border: "none", cursor: "pointer", padding: "4px 10px", borderRadius: "6px", flexShrink: 0 }}>Yes ✓</button>
                        <button type="button" onClick={() => setSuggestion(null)} style={{ fontSize: "12px", fontWeight: 700, color: "#717171", background: "none", border: "none", cursor: "pointer", padding: "4px 6px", flexShrink: 0 }}>No ✗</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", letterSpacing: 0.5, textTransform: "uppercase" as const, marginBottom: 6, display: "block" }}>Category *</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {CATEGORIES.map(c => (
                    <button key={c.slug} type="button" onClick={() => setActCategory(c.slug)} style={{ padding: "6px 12px", borderRadius: 999, border: actCategory === c.slug ? "1px solid #C4664A" : "1px solid #E5E7EB", background: actCategory === c.slug ? "#C4664A" : "white", color: actCategory === c.slug ? "white" : "#1B3A5C", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>{c.label}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: defaultDate ? "1fr" : "1fr 1fr", gap: "10px" }}>
                {!defaultDate && (
                  <div>
                    <label style={labelStyle}>Date *</label>
                    <input type="date" value={actDate} onChange={e => setActDate(e.target.value)} style={inputStyle} />
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Start time</label>
                  <input type="time" value={actTime} onChange={e => setActTime(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Venue (optional)</label>
                <input type="text" value={actVenue} onChange={e => setActVenue(e.target.value)} placeholder="e.g. Jamsil Baseball Stadium" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Address (optional)</label>
                <input type="text" value={actAddress} onChange={e => { setActAddress(e.target.value); setActAddressFromPlaces(false); }} placeholder="e.g. 123 Bukchon-ro, Seoul" style={inputStyle} />
                {actAddressFromPlaces && <p style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>From Google Places — edit if needed</p>}
              </div>

              <div>
                <label style={labelStyle}>Website / ticket link (optional)</label>
                <input type="url" value={actWebsite} onChange={e => setActWebsite(e.target.value)} placeholder="https://..." style={inputStyle} />
              </div>

              <button type="button" onClick={() => setActShowMore(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#717171", fontWeight: 600, textAlign: "left", padding: 0, fontFamily: "inherit" }}>
                {actShowMore ? "− Less details" : "+ Price, end time, confirmation code, notes"}
              </button>

              {actShowMore && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={labelStyle}>Cost (optional)</label>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <select value={actCurrency} onChange={e => setActCurrency(e.target.value)} style={{ ...inputStyle, width: "74px", flexShrink: 0, padding: "11px 6px", cursor: "pointer" }}>
                          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input type="number" value={actPrice} onChange={e => setActPrice(e.target.value)} placeholder="e.g. 45.00" min="0" step="0.01" style={{ ...inputStyle, flex: 1 }} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>End time</label>
                      <input type="time" value={actEndTime} onChange={e => setActEndTime(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Confirmation code</label>
                    <input type="text" value={actConfCode} onChange={e => setActConfCode(e.target.value)} placeholder="e.g. ABC123" style={{ ...inputStyle, fontFamily: "monospace" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Notes</label>
                    <textarea value={actNotes} onChange={e => setActNotes(e.target.value)} placeholder="Anything else to remember..." rows={3} style={{ ...inputStyle, resize: "none" }} />
                  </div>
                </>
              )}
            </>
          )}

          {/* ── LODGING FORM ── */}
          {itemType === "lodging" && (
            <>
              <div>
                <label style={labelStyle}>Property name *</label>
                <input type="text" value={lodgName} onChange={e => setLodgName(e.target.value)} placeholder="e.g. Friend's house, The Witchery" style={inputStyle} autoFocus />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Check-in date *</label>
                  <input type="date" value={lodgCheckInDate} onChange={e => setLodgCheckInDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Check-in time</label>
                  <input type="time" value={lodgCheckInTime} onChange={e => setLodgCheckInTime(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Check-out date *</label>
                  <input type="date" value={lodgCheckOutDate} onChange={e => setLodgCheckOutDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Check-out time</label>
                  <input type="time" value={lodgCheckOutTime} onChange={e => setLodgCheckOutTime(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Address (optional)</label>
                <input type="text" value={lodgAddress} onChange={e => setLodgAddress(e.target.value)} placeholder="e.g. 12 Grassmarket, Edinburgh" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Confirmation / booking reference (optional)</label>
                <input type="text" value={lodgConfCode} onChange={e => setLodgConfCode(e.target.value)} placeholder="e.g. ABC123" style={{ ...inputStyle, fontFamily: "monospace" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Total cost (optional)</label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <select value={lodgCurrency} onChange={e => setLodgCurrency(e.target.value)} style={{ ...inputStyle, width: "74px", flexShrink: 0, padding: "11px 6px", cursor: "pointer" }}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="number" value={lodgCost} onChange={e => setLodgCost(e.target.value)} placeholder="e.g. 450.00" min="0" step="0.01" style={{ ...inputStyle, flex: 1 }} />
                  </div>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <textarea value={lodgNotes} onChange={e => setLodgNotes(e.target.value)} placeholder="Host contact, access code, parking, etc." rows={3} style={{ ...inputStyle, resize: "none" }} />
              </div>
            </>
          )}

          {error && <p style={{ fontSize: "13px", color: "#C4664A", fontWeight: 600 }}>{error}</p>}

          <button
            type="button"
            onClick={itemType === "activity" ? saveActivity : saveLodging}
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
            {saving ? "Saving..." : itemType === "activity" ? "Save activity →" : "Save lodging →"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
