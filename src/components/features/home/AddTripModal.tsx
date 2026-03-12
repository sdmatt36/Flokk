"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function AddTripButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 600,
          color: "#C4664A",
          padding: 0,
        }}
      >
        Add a trip
      </button>
      {open && <AddTripModal onClose={() => setOpen(false)} />}
    </>
  );
}

function AddTripModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!destination.trim() || !startDate || !endDate) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, startDate, endDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.push(`/trips/${data.tripId}`);
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.4)",
          zIndex: 100,
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 101,
          backgroundColor: "#fff",
          borderRadius: "16px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
          width: "calc(100% - 48px)",
          maxWidth: "480px",
          padding: "32px 28px 24px",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#717171",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "4px",
          }}
        >
          <X size={18} />
        </button>

        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#1a1a1a", marginBottom: "24px" }}>
          Add a trip
        </h2>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Destination */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>
              Destination
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Kyoto, Japan"
              style={{
                fontSize: "15px",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1.5px solid #EEEEEE",
                outline: "none",
                color: "#1a1a1a",
                backgroundColor: "#fff",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  fontSize: "14px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1.5px solid #EEEEEE",
                  outline: "none",
                  color: "#1a1a1a",
                  backgroundColor: "#fff",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>
                End date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                style={{
                  fontSize: "14px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1.5px solid #EEEEEE",
                  outline: "none",
                  color: "#1a1a1a",
                  backgroundColor: "#fff",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {error && (
            <p style={{ fontSize: "13px", color: "#C4664A" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "4px",
              padding: "14px",
              borderRadius: "999px",
              backgroundColor: "#C4664A",
              color: "#fff",
              fontWeight: 700,
              fontSize: "15px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Creating..." : "Create trip"}
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              color: "#717171",
              textAlign: "center",
              padding: "4px",
            }}
          >
            Cancel
          </button>
        </form>
      </div>
    </>
  );
}
