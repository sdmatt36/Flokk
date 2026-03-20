"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AIRLINES, AIRPORTS } from "@/lib/airlines";

interface AddFlightModalProps {
  tripId: string;
  onClose: () => void;
  onSaved: () => void;
}

const CABIN_CLASSES = [
  { value: "economy", label: "Economy" },
  { value: "premium_economy", label: "Premium Economy" },
  { value: "business", label: "Business" },
  { value: "first", label: "First" },
];

const FLIGHT_TYPES = [
  { value: "outbound", label: "Outbound" },
  { value: "return", label: "Return" },
  { value: "connection", label: "Connection" },
];

export function AddFlightModal({ tripId, onClose, onSaved }: AddFlightModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isBooked, setIsBooked] = useState(false);

  const [type, setType] = useState("outbound");
  const [airline, setAirline] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [fromAirport, setFromAirport] = useState("");
  const [toAirport, setToAirport] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [duration, setDuration] = useState("");
  const [cabinClass, setCabinClass] = useState("economy");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [seatNumbers, setSeatNumbers] = useState("");
  const [notes, setNotes] = useState("");

  const fromCity = AIRPORTS.find((a) => a.code === fromAirport)?.city ?? fromAirport;
  const toCity = AIRPORTS.find((a) => a.code === toAirport)?.city ?? toAirport;

  const canSave =
    flightNumber.trim() !== "" &&
    (isBooked || (fromAirport !== "" && toAirport !== "" && departureDate !== "" && departureTime !== ""));

  async function handleSave() {
    if (!canSave) {
      setError("Please fill in flight number, airports, and departure date/time.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/trips/${tripId}/flights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          airline,
          flightNumber,
          fromAirport,
          fromCity,
          toAirport,
          toCity,
          departureDate,
          departureTime,
          arrivalDate: arrivalDate || null,
          arrivalTime: arrivalTime || null,
          duration: duration || null,
          cabinClass,
          confirmationCode: confirmationCode || null,
          seatNumbers: seatNumbers || null,
          notes: notes || null,
          status: isBooked ? "booked" : "saved",
        }),
      });
      if (!res.ok) throw new Error("Failed to save flight");
      onSaved();
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const labelStyle = { fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: "5px", display: "block" };
  const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #E5E5E5", fontSize: "14px", color: "#1a1a1a", backgroundColor: "#fff", outline: "none", boxSizing: "border-box" as const };
  const selectStyle = { ...inputStyle, appearance: "none" as const };

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto", padding: "24px 20px 40px", paddingBottom: "max(40px, env(safe-area-inset-bottom))" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <p style={{ fontSize: "17px", fontWeight: 800, color: "#1a1a1a" }}>Add Flight</p>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#999", padding: "4px", lineHeight: 1 }}>×</button>
        </div>

        {/* Confirmed booking toggle */}
        <div style={{ backgroundColor: "#F5F8FC", border: "1.5px solid #D8E4F0", borderRadius: "12px", padding: "12px 14px", marginBottom: "18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px" }}>Confirmed booking</p>
            <p style={{ fontSize: "12px", color: "#717171" }}>Booked flights appear in your itinerary</p>
          </div>
          <button
            onClick={() => setIsBooked(!isBooked)}
            style={{
              flexShrink: 0,
              width: "48px", height: "26px",
              borderRadius: "999px",
              border: "none",
              cursor: "pointer",
              backgroundColor: isBooked ? "#1B3A5C" : "#D1D5DB",
              position: "relative",
              transition: "background-color 0.2s",
            }}
          >
            <span style={{
              position: "absolute",
              top: "3px",
              left: isBooked ? "25px" : "3px",
              width: "20px", height: "20px",
              borderRadius: "50%",
              backgroundColor: "#fff",
              transition: "left 0.2s",
              display: "block",
            }} />
          </button>
        </div>

        {/* Flight Type */}
        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Flight Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle}>
            {FLIGHT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Airline + Flight Number */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label style={labelStyle}>Airline</label>
            <select value={airline} onChange={(e) => setAirline(e.target.value)} style={selectStyle}>
              <option value="">Select airline</option>
              {AIRLINES.map((a) => (
                <option key={a.code} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Flight # *</label>
            <input
              type="text"
              placeholder="e.g. DL405"
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
              style={inputStyle}
            />
          </div>
        </div>

        {/* From / To */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label style={labelStyle}>From *</label>
            <select value={fromAirport} onChange={(e) => setFromAirport(e.target.value)} style={selectStyle}>
              <option value="">Airport</option>
              {AIRPORTS.map((a) => (
                <option key={a.code} value={a.code}>{a.code} — {a.city}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>To *</label>
            <select value={toAirport} onChange={(e) => setToAirport(e.target.value)} style={selectStyle}>
              <option value="">Airport</option>
              {AIRPORTS.map((a) => (
                <option key={a.code} value={a.code}>{a.code} — {a.city}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Departure */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label style={labelStyle}>Departure Date *</label>
            <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Departure Time *</label>
            <input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Arrival (optional) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label style={labelStyle}>Arrival Date <span style={{ textTransform: "none", fontWeight: 400, fontSize: "10px" }}>(optional)</span></label>
            <input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Arrival Time <span style={{ textTransform: "none", fontWeight: 400, fontSize: "10px" }}>(optional)</span></label>
            <input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Duration + Cabin */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label style={labelStyle}>Duration</label>
            <input
              type="text"
              placeholder="e.g. 14h 30m"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Cabin Class</label>
            <select value={cabinClass} onChange={(e) => setCabinClass(e.target.value)} style={selectStyle}>
              {CABIN_CLASSES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Confirmation + Seats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label style={labelStyle}>Confirmation Code</label>
            <input
              type="text"
              placeholder="e.g. ABC123"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value.toUpperCase())}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Seat Numbers</label>
            <input
              type="text"
              placeholder="e.g. 12A, 12B"
              value={seatNumbers}
              onChange={(e) => setSeatNumbers(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Notes</label>
          <textarea
            placeholder="Meal preferences, frequent flyer number, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" as const, lineHeight: 1.5 }}
          />
        </div>

        {error && (
          <p style={{ fontSize: "13px", color: "#C4664A", marginBottom: "12px" }}>{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          style={{ width: "100%", padding: "14px", borderRadius: "12px", backgroundColor: saving || !canSave ? "#ccc" : "#1B3A5C", color: "#fff", fontSize: "15px", fontWeight: 700, border: "none", cursor: saving || !canSave ? "not-allowed" : "pointer" }}
        >
          {saving ? "Saving…" : "Save Flight"}
        </button>
      </div>
    </div>,
    document.body
  );
}
