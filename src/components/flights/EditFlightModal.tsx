"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MODAL_OVERLAY_CLASSES, MODAL_PANEL_CLASSES } from "@/lib/modal-classes";
import { AIRLINES } from "@/lib/airlines";
import { getAirportByCode } from "@/lib/airports";
import { AirportAutocomplete } from "@/components/shared/AirportAutocomplete";

type Flight = {
  id: string;
  type: string;
  airline: string;
  flightNumber: string;
  fromAirport: string;
  fromCity: string;
  toAirport: string;
  toCity: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  duration?: string | null;
  cabinClass: string;
  confirmationCode?: string | null;
  seatNumbers?: string | null;
  notes?: string | null;
  status?: string;
};

type BookingLeg = {
  id: string;
  flightNumber: string;
  fromAirport: string;
  fromCity: string;
  toAirport: string;
  toCity: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string | null;
  arrivalTime: string | null;
  airline: string;
};

type FlightBookingFull = {
  id: string;
  airline: string | null;
  cabinClass: string | null;
  confirmationCode: string | null;
  flights: BookingLeg[];
};

// ── Legacy mode (single Flight) ───────────────────────────────────────────────

interface LegacyProps {
  flight: Flight;
  tripId: string;
  onClose: () => void;
  onSaved: (updated: Flight) => void;
  flightBookingId?: never;
  onBookingSaved?: never;
}

// ── Booking mode (multi-leg FlightBooking) ────────────────────────────────────

interface BookingProps {
  flightBookingId: string;
  tripId: string;
  onClose: () => void;
  onBookingSaved: () => void;
  flight?: never;
  onSaved?: never;
}

type EditFlightModalProps = LegacyProps | BookingProps;

const CABIN_CLASSES = [
  { value: "economy", label: "Economy" },
  { value: "premium_economy", label: "Premium Economy" },
  { value: "business", label: "Business" },
  { value: "first", label: "First" },
];

const FLIGHT_TYPES = [
  { value: "outbound", label: "Outbound" },
  { value: "round_trip", label: "Round Trip" },
  { value: "return", label: "Return only" },
  { value: "connection", label: "Connection" },
];

// ── Booking Mode Component ────────────────────────────────────────────────────

function EditFlightBookingModal({ flightBookingId, tripId, onClose, onBookingSaved }: BookingProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [booking, setBooking] = useState<FlightBookingFull | null>(null);
  const [airline, setAirline] = useState("");
  const [cabinClass, setCabinClass] = useState("economy");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [legEdits, setLegEdits] = useState<Array<{
    id: string;
    flightNumber: string;
    fromAirport: string;
    toAirport: string;
    departureDate: string;
    departureTime: string;
    arrivalDate: string;
    arrivalTime: string;
  }>>([]);

  useEffect(() => {
    fetch(`/api/trips/${tripId}/flight-bookings/${flightBookingId}`)
      .then(r => r.json())
      .then((data: FlightBookingFull) => {
        setBooking(data);
        setAirline(data.airline ?? "");
        setCabinClass(data.cabinClass ?? "economy");
        setConfirmationCode(data.confirmationCode ?? "");
        setLegEdits(data.flights.map(f => ({
          id: f.id,
          flightNumber: f.flightNumber,
          fromAirport: f.fromAirport,
          toAirport: f.toAirport,
          departureDate: f.departureDate,
          departureTime: f.departureTime,
          arrivalDate: f.arrivalDate ?? "",
          arrivalTime: f.arrivalTime ?? "",
        })));
      })
      .catch(() => setError("Could not load booking details."))
      .finally(() => setLoading(false));
  }, [flightBookingId, tripId]);

  function updateLeg(index: number, field: string, value: string) {
    setLegEdits(prev => prev.map((leg, i) => i === index ? { ...leg, [field]: value } : leg));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/trips/${tripId}/flight-bookings/${flightBookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          airline: airline || null,
          cabinClass,
          confirmationCode: confirmationCode || null,
          legs: legEdits.map(leg => {
            const fromCity = getAirportByCode(leg.fromAirport)?.city ?? leg.fromAirport;
            const toCity = getAirportByCode(leg.toAirport)?.city ?? leg.toAirport;
            return {
              id: leg.id,
              flightNumber: leg.flightNumber,
              fromAirport: leg.fromAirport,
              fromCity,
              toAirport: leg.toAirport,
              toCity,
              departureDate: leg.departureDate,
              departureTime: leg.departureTime,
              arrivalDate: leg.arrivalDate || null,
              arrivalTime: leg.arrivalTime || null,
            };
          }),
        }),
      });
      if (!res.ok) throw new Error("Failed to update booking");
      onBookingSaved();
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
      className={MODAL_OVERLAY_CLASSES}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${MODAL_PANEL_CLASSES} sm:w-[560px]`}
        style={{ padding: "24px 20px 40px" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <p style={{ fontSize: "17px", fontWeight: 800, color: "#1a1a1a" }}>Edit Flight Booking</p>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#999", padding: "4px", lineHeight: 1 }}>×</button>
        </div>

        {loading && <p style={{ fontSize: "14px", color: "#717171", textAlign: "center", padding: "32px 0" }}>Loading…</p>}

        {!loading && booking && (
          <>
            {/* Booking-level fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <div>
                <label style={labelStyle}>Airline</label>
                <select value={airline} onChange={e => setAirline(e.target.value)} style={selectStyle}>
                  <option value="">Select airline</option>
                  {AIRLINES.map(a => <option key={a.code} value={a.name}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Cabin Class</label>
                <select value={cabinClass} onChange={e => setCabinClass(e.target.value)} style={selectStyle}>
                  {CABIN_CLASSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Confirmation Code</label>
              <input type="text" value={confirmationCode} onChange={e => setConfirmationCode(e.target.value.toUpperCase())} style={inputStyle} />
            </div>

            {/* Per-leg editing */}
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "10px" }}>
              Flight Legs
            </p>
            {legEdits.map((leg, i) => (
              <div key={leg.id} style={{ border: "1.5px solid #E5E5E5", borderRadius: "12px", padding: "14px", marginBottom: "12px" }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#1B3A5C", marginBottom: "10px" }}>
                  Leg {i + 1}: {leg.fromAirport} → {leg.toAirport}
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  <div>
                    <label style={labelStyle}>From</label>
                    <AirportAutocomplete
                      value={leg.fromAirport}
                      onChange={v => updateLeg(i, "fromAirport", v)}
                      ariaLabel="From airport"
                      placeholder="From"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>To</label>
                    <AirportAutocomplete
                      value={leg.toAirport}
                      onChange={v => updateLeg(i, "toAirport", v)}
                      ariaLabel="To airport"
                      placeholder="To"
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  <div>
                    <label style={labelStyle}>Flight #</label>
                    <input type="text" value={leg.flightNumber} onChange={e => updateLeg(i, "flightNumber", e.target.value.toUpperCase())} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Departure Date</label>
                    <input type="date" value={leg.departureDate} onChange={e => updateLeg(i, "departureDate", e.target.value)} style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Dep Time</label>
                    <input type="time" value={leg.departureTime} onChange={e => updateLeg(i, "departureTime", e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Arr Time</label>
                    <input type="time" value={leg.arrivalTime} onChange={e => updateLeg(i, "arrivalTime", e.target.value)} style={inputStyle} />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {error && <p style={{ fontSize: "13px", color: "#e53e3e", marginBottom: "12px" }}>{error}</p>}

        {!loading && (
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ width: "100%", padding: "14px", backgroundColor: saving ? "#ccc" : "#1B3A5C", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Legacy Mode Component ─────────────────────────────────────────────────────

function EditFlightLegacyModal({ flight, tripId, onClose, onSaved }: LegacyProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [type, setType] = useState(flight.type ?? "outbound");
  const [airline, setAirline] = useState(flight.airline ?? "");
  const [flightNumber, setFlightNumber] = useState(flight.flightNumber ?? "");
  const [fromAirport, setFromAirport] = useState(flight.fromAirport ?? "");
  const [toAirport, setToAirport] = useState(flight.toAirport ?? "");
  const [departureDate, setDepartureDate] = useState(flight.departureDate ?? "");
  const [departureTime, setDepartureTime] = useState(flight.departureTime ?? "");
  const [arrivalDate, setArrivalDate] = useState(flight.arrivalDate ?? "");
  const [arrivalTime, setArrivalTime] = useState(flight.arrivalTime ?? "");
  const [duration, setDuration] = useState(flight.duration ?? "");
  const [cabinClass, setCabinClass] = useState(flight.cabinClass ?? "economy");
  const [confirmationCode, setConfirmationCode] = useState(flight.confirmationCode ?? "");
  const [seatNumbers, setSeatNumbers] = useState(flight.seatNumbers ?? "");
  const [notes, setNotes] = useState(flight.notes ?? "");
  const [status, setStatus] = useState(flight.status ?? "saved");

  const canSave = flightNumber.trim() !== "" && fromAirport !== "" && toAirport !== "" && departureDate !== "" && departureTime !== "";

  const fromCity = getAirportByCode(fromAirport)?.city ?? fromAirport;
  const toCity = getAirportByCode(toAirport)?.city ?? toAirport;

  async function handleSave() {
    if (!canSave) {
      setError("Please fill in flight number, airports, and departure date/time.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/trips/${tripId}/flights/${flight.id}`, {
        method: "PATCH",
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
          status,
        }),
      });
      if (!res.ok) throw new Error("Failed to update flight");
      const updated = await res.json() as Flight;
      onSaved(updated);
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
      className={MODAL_OVERLAY_CLASSES}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${MODAL_PANEL_CLASSES} sm:w-[560px]`}
        style={{ padding: "24px 20px 40px" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <p style={{ fontSize: "17px", fontWeight: 800, color: "#1a1a1a" }}>Edit Flight</p>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#999", padding: "4px", lineHeight: 1 }}>×</button>
        </div>

        {/* Status toggle */}
        <div style={{ backgroundColor: "#F5F8FC", border: "1.5px solid #D8E4F0", borderRadius: "12px", padding: "12px 14px", marginBottom: "18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px" }}>Confirmed booking</p>
            <p style={{ fontSize: "12px", color: "#717171" }}>Booked flights appear in your itinerary</p>
          </div>
          <button
            onClick={() => setStatus(status === "booked" ? "saved" : "booked")}
            style={{ flexShrink: 0, width: "48px", height: "26px", borderRadius: "999px", border: "none", cursor: "pointer", backgroundColor: status === "booked" ? "#1B3A5C" : "#D1D5DB", position: "relative", transition: "background-color 0.2s" }}
          >
            <span style={{ position: "absolute", top: "3px", left: status === "booked" ? "25px" : "3px", width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s", display: "block" }} />
          </button>
        </div>

        {/* Flight Type */}
        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Flight Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle}>
            {FLIGHT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Airline + Flight Number */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label style={labelStyle}>Airline</label>
            <select value={airline} onChange={(e) => setAirline(e.target.value)} style={selectStyle}>
              <option value="">Select airline</option>
              {AIRLINES.map((a) => <option key={a.code} value={a.name}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Flight # *</label>
            <input type="text" placeholder="e.g. JL307" value={flightNumber} onChange={(e) => setFlightNumber(e.target.value.toUpperCase())} style={inputStyle} />
          </div>
        </div>

        {/* From / To */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label style={labelStyle}>From *</label>
            <AirportAutocomplete
              value={fromAirport}
              onChange={setFromAirport}
              ariaLabel="From airport"
              placeholder="From airport or city"
            />
          </div>
          <div>
            <label style={labelStyle}>To *</label>
            <AirportAutocomplete
              value={toAirport}
              onChange={setToAirport}
              ariaLabel="To airport"
              placeholder="To airport or city"
            />
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

        {/* Arrival */}
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
            <label style={labelStyle}>Duration <span style={{ textTransform: "none", fontWeight: 400, fontSize: "10px" }}>(optional)</span></label>
            <input type="text" placeholder="e.g. 2h 30m" value={duration} onChange={(e) => setDuration(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Cabin Class</label>
            <select value={cabinClass} onChange={(e) => setCabinClass(e.target.value)} style={selectStyle}>
              {CABIN_CLASSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {/* Confirmation + Seats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label style={labelStyle}>Confirmation Code</label>
            <input type="text" placeholder="e.g. ABC123" value={confirmationCode} onChange={(e) => setConfirmationCode(e.target.value.toUpperCase())} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Seat(s)</label>
            <input type="text" placeholder="e.g. 14A, 14B" value={seatNumbers} onChange={(e) => setSeatNumbers(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Notes</label>
          <textarea rows={3} placeholder="Anything else..." value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, resize: "none", fontFamily: "inherit" }} />
        </div>

        {error && <p style={{ fontSize: "13px", color: "#e53e3e", marginBottom: "12px" }}>{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          style={{ width: "100%", padding: "14px", backgroundColor: canSave ? "#1B3A5C" : "#ccc", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: canSave ? "pointer" : "default", fontFamily: "inherit" }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>,
    document.body
  );
}

// ── Public export — routes to correct mode ────────────────────────────────────

export function EditFlightModal(props: EditFlightModalProps) {
  if (props.flightBookingId) {
    return (
      <EditFlightBookingModal
        flightBookingId={props.flightBookingId}
        tripId={props.tripId}
        onClose={props.onClose}
        onBookingSaved={props.onBookingSaved!}
      />
    );
  }
  return (
    <EditFlightLegacyModal
      flight={props.flight!}
      tripId={props.tripId}
      onClose={props.onClose}
      onSaved={props.onSaved!}
    />
  );
}
