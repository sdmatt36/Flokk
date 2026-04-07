"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

type DayInfo = {
  dayIndex: number;
  label: string;
  count: number;
};

type PlanningTrip = {
  id: string;
  title: string;
  destinationCity: string | null;
  startDate: string | null;
};

export function SharePageBottomBar({
  tripId,
  isOwner,
  shareToken,
  days = [],
}: {
  tripId: string;
  isOwner: boolean;
  shareToken?: string;
  days?: DayInfo[];
}) {
  const { isSignedIn, isLoaded } = useAuth();
  const pathname = usePathname();

  // Steal modal state
  const [stealModalOpen, setStealModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<"days" | "trip">("days");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [planningTrips, setPlanningTrips] = useState<PlanningTrip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [stealing, setStealing] = useState(false);
  const [stealSuccess, setStealSuccess] = useState<{ copied: number; tripName: string; targetTripId: string } | null>(null);
  const [stealError, setStealError] = useState<string | null>(null);

  const redirectUrl = encodeURIComponent(pathname ?? "");

  function openStealModal() {
    setStealModalOpen(true);
    setModalStep("days");
    setSelectedDays([]);
    setSelectedTripId(null);
    setStealSuccess(null);
    setStealError(null);
  }

  function closeStealModal() {
    setStealModalOpen(false);
  }

  function toggleDay(dayIndex: number) {
    setSelectedDays(prev =>
      prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]
    );
  }

  async function goToTripStep() {
    setModalStep("trip");
    setTripsLoading(true);
    try {
      const res = await fetch("/api/trips?status=planning");
      if (res.ok) {
        const data = await res.json() as { trips: PlanningTrip[] };
        setPlanningTrips(data.trips ?? []);
      }
    } catch { /* ignore */ } finally {
      setTripsLoading(false);
    }
  }

  async function handleSteal() {
    if (!selectedTripId) return;
    setStealing(true);
    setStealError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/steal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTripId: selectedTripId, dayIndexes: selectedDays }),
      });
      const data = await res.json() as { copied?: number; tripName?: string; error?: string };
      if (!res.ok) {
        setStealError(data.error ?? "Something went wrong.");
        return;
      }
      setStealSuccess({ copied: data.copied!, tripName: data.tripName!, targetTripId: selectedTripId });
      closeStealModal();
    } catch {
      setStealError("Something went wrong. Please try again.");
    } finally {
      setStealing(false);
    }
  }

  if (!isLoaded) return null;

  if (isOwner) {
    return (
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, backgroundColor: "#fff", borderTop: "1px solid #F0F0F0", padding: "14px 20px", textAlign: "center", boxShadow: "0 -4px 24px rgba(0,0,0,0.06)" }}>
        <p style={{ fontSize: "13px", color: "#888", margin: "0 0 4px" }}>This is your trip</p>
        <a href={`/trips/${tripId}`} style={{ fontSize: "14px", fontWeight: 700, color: "#C4664A", textDecoration: "none" }}>
          View &amp; edit →
        </a>
        {shareToken && (
          <p style={{ fontSize: "12px", color: "#AAAAAA", margin: "6px 0 0" }}>
            <a href={`/share/${shareToken}?preview=true`} style={{ color: "#AAAAAA", textDecoration: "underline" }}>
              Preview as visitor
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Bottom bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, backgroundColor: "#fff", borderTop: "1px solid #F0F0F0", padding: "16px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}>
        {isSignedIn ? (
          <>
            {stealSuccess && (
              <p style={{ fontSize: "13px", color: "#0A1628", textAlign: "center", margin: 0 }}>
                {stealSuccess.copied} places copied to{" "}
                <a href={`/trips/${stealSuccess.targetTripId}`} style={{ color: "#C4664A", fontWeight: 700, textDecoration: "none" }}>
                  {stealSuccess.tripName}
                </a>
              </p>
            )}
            <button
              onClick={openStealModal}
              style={{ width: "100%", maxWidth: "400px", padding: "14px", borderRadius: "999px", backgroundColor: "#C4664A", color: "#fff", fontWeight: 700, fontSize: "15px", border: "none", cursor: "pointer" }}
            >
              Steal This Itinerary
            </button>
            <p style={{ fontSize: "12px", color: "#888", margin: 0, textAlign: "center" }}>
              or save individual places above
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: "15px", fontWeight: 800, color: "#1a1a1a", textAlign: "center", marginBottom: "2px" }}>
              Plan your own family trip with Flokk — free to join
            </p>
            <p style={{ fontSize: "12px", color: "#717171", textAlign: "center" }}>
              Save places from anywhere. Build your itinerary. Travel smarter.
            </p>
            <a
              href={`/sign-up?redirect_url=${redirectUrl}`}
              style={{ width: "100%", maxWidth: "400px", padding: "14px", borderRadius: "999px", backgroundColor: "#C4664A", color: "#fff", fontWeight: 700, fontSize: "15px", textAlign: "center", textDecoration: "none", display: "block" }}
            >
              Get started free
            </a>
            <p style={{ fontSize: "12px", color: "#AAAAAA" }}>
              Already have an account?{" "}
              <a href={`/sign-in?redirect_url=${redirectUrl}`} style={{ color: "#C4664A", textDecoration: "none", fontWeight: 600 }}>
                Sign in
              </a>
            </p>
          </>
        )}
      </div>

      {/* Steal modal */}
      {stealModalOpen && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={closeStealModal}
        >
          <div
            style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "480px", padding: "28px 24px 40px", maxHeight: "82vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            {modalStep === "days" ? (
              <>
                <p style={{ fontSize: "20px", fontWeight: 700, color: "#1B3A5C", fontFamily: "'Playfair Display', Georgia, serif", marginBottom: "6px" }}>
                  Which days do you want?
                </p>
                <p style={{ fontSize: "13px", color: "#717171", marginBottom: "20px" }}>
                  Select the days you&apos;d like to copy into your trip.
                </p>

                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
                  {selectedDays.length === days.length && days.length > 0 ? (
                    <button onClick={() => setSelectedDays([])} style={{ fontSize: "13px", color: "#C4664A", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}>
                      Deselect all
                    </button>
                  ) : (
                    <button onClick={() => setSelectedDays(days.map(d => d.dayIndex))} style={{ fontSize: "13px", color: "#C4664A", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}>
                      Select all
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                  {days.map(day => {
                    const selected = selectedDays.includes(day.dayIndex);
                    return (
                      <div
                        key={day.dayIndex}
                        onClick={() => toggleDay(day.dayIndex)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: "10px", border: selected ? "2px solid #C4664A" : "1px solid #E5E5E5", backgroundColor: selected ? "#FFF4EE" : "#FAFAFA", cursor: "pointer" }}
                      >
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: 700, color: "#0A1628", margin: 0 }}>{day.label}</p>
                          <p style={{ fontSize: "12px", color: "#717171", margin: "2px 0 0 0" }}>{day.count} {day.count === 1 ? "stop" : "stops"}</p>
                        </div>
                        <div style={{ width: "20px", height: "20px", borderRadius: "4px", border: selected ? "none" : "2px solid #CCCCCC", backgroundColor: selected ? "#C4664A" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {selected && <span style={{ color: "#fff", fontSize: "13px", fontWeight: 900, lineHeight: 1 }}>✓</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={goToTripStep}
                  disabled={selectedDays.length === 0}
                  style={{ width: "100%", padding: "14px", borderRadius: "999px", backgroundColor: selectedDays.length === 0 ? "#E5E5E5" : "#C4664A", color: selectedDays.length === 0 ? "#AAAAAA" : "#fff", fontWeight: 700, fontSize: "15px", border: "none", cursor: selectedDays.length === 0 ? "not-allowed" : "pointer" }}
                >
                  Next — {selectedDays.length} {selectedDays.length === 1 ? "day" : "days"} selected
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setModalStep("days")}
                  style={{ fontSize: "13px", color: "#717171", background: "none", border: "none", cursor: "pointer", padding: "0 0 16px 0", display: "block" }}
                >
                  Back
                </button>
                <p style={{ fontSize: "20px", fontWeight: 700, color: "#1B3A5C", fontFamily: "'Playfair Display', Georgia, serif", marginBottom: "6px" }}>
                  Copy to which trip?
                </p>
                <p style={{ fontSize: "13px", color: "#717171", marginBottom: "20px" }}>
                  These places will be added to your vault for that trip.
                </p>

                {tripsLoading ? (
                  <p style={{ fontSize: "14px", color: "#717171", textAlign: "center", padding: "24px 0" }}>Loading your trips...</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                    {planningTrips.length === 0 && (
                      <p style={{ fontSize: "14px", color: "#717171", textAlign: "center", padding: "8px 0 16px" }}>No planning trips found.</p>
                    )}
                    {planningTrips.map(t => {
                      const selected = selectedTripId === t.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTripId(t.id)}
                          style={{ padding: "14px 16px", borderRadius: "10px", border: selected ? "2px solid #C4664A" : "1px solid #E5E5E5", backgroundColor: selected ? "#FFF4EE" : "#FAFAFA", cursor: "pointer" }}
                        >
                          <p style={{ fontSize: "14px", fontWeight: 700, color: "#0A1628", margin: 0 }}>{t.title}</p>
                          {t.destinationCity && <p style={{ fontSize: "12px", color: "#717171", margin: "2px 0 0 0" }}>{t.destinationCity}</p>}
                        </div>
                      );
                    })}
                    <a
                      href="/trips/new"
                      style={{ display: "block", padding: "14px 16px", borderRadius: "10px", border: "1px dashed #CCCCCC", textAlign: "center", fontSize: "14px", color: "#717171", textDecoration: "none", fontWeight: 600 }}
                    >
                      + Start a new trip
                    </a>
                  </div>
                )}

                {stealError && (
                  <p style={{ fontSize: "13px", color: "#C4664A", marginBottom: "12px" }}>{stealError}</p>
                )}

                <button
                  onClick={handleSteal}
                  disabled={!selectedTripId || stealing}
                  style={{ width: "100%", padding: "14px", borderRadius: "999px", backgroundColor: !selectedTripId || stealing ? "#E5E5E5" : "#C4664A", color: !selectedTripId || stealing ? "#AAAAAA" : "#fff", fontWeight: 700, fontSize: "15px", border: "none", cursor: !selectedTripId || stealing ? "not-allowed" : "pointer" }}
                >
                  {stealing ? "Copying..." : `Copy ${selectedDays.length} ${selectedDays.length === 1 ? "day" : "days"}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
