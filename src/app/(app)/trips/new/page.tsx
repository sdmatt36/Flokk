"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

function NewTripForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const destParam = searchParams.get("destination") ?? "";
  const countryParam = searchParams.get("country") ?? "";
  const prefilled = destParam && countryParam
    ? `${destParam}, ${countryParam}`
    : destParam;

  const [destination, setDestination] = useState(prefilled);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    fontSize: "15px",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1.5px solid #EEEEEE",
    outline: "none",
    color: "#1a1a1a",
    backgroundColor: "#fff",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "80px" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "32px 24px 0" }}>

        {/* Back link */}
        <Link
          href="/trips"
          style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#717171", textDecoration: "none", marginBottom: "28px" }}
        >
          <ChevronLeft size={15} />
          Back to trips
        </Link>

        {/* Heading */}
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "26px", fontWeight: 800, color: "#1B3A5C", marginBottom: "8px" }}>
          Add a trip
        </h1>
        <p style={{ fontSize: "14px", color: "#717171", marginBottom: "32px" }}>
          Where are you headed? Fill in the details to get started.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Destination */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>Destination</label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Kyoto, Japan"
              autoFocus={!prefilled}
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#C4664A"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }}
            />
          </div>

          {/* Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ ...inputStyle, fontSize: "14px", padding: "12px" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#C4664A"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>End date</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ ...inputStyle, fontSize: "14px", padding: "12px" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#C4664A"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }}
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

        </form>
      </div>
    </div>
  );
}

export default function NewTripPage() {
  return (
    <Suspense>
      <NewTripForm />
    </Suspense>
  );
}
