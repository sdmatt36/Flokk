"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { DestinationSuggestion } from "@/app/api/destinations/lookup/route";

function NewTripForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Pre-fill from query params if navigated here with ?destination=&country=
  const destParam = searchParams.get("destination") ?? "";
  const countryParam = searchParams.get("country") ?? "";

  const [cityInput, setCityInput] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<DestinationSuggestion[]>([]);
  const [selectedCities, setSelectedCities] = useState<DestinationSuggestion[]>(() => {
    // Pre-fill from query params if present
    if (destParam && countryParam) {
      return [{ placeId: "__prefilled__", cityName: destParam, countryName: countryParam, region: "", description: "" }];
    }
    if (destParam) {
      return [{ placeId: "__prefilled__", cityName: destParam, countryName: "", region: "", description: "" }];
    }
    return [];
  });
  const [citySuggestOpen, setCitySuggestOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced fetch on cityInput
  useEffect(() => {
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    if (cityInput.trim().length < 2) {
      setCitySuggestions([]);
      setCitySuggestOpen(false);
      return;
    }
    cityDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/destinations/lookup?q=${encodeURIComponent(cityInput)}`);
        const data = await res.json();
        setCitySuggestions(Array.isArray(data) ? data : []);
        setCitySuggestOpen(true);
      } catch {
        setCitySuggestions([]);
      }
    }, 400);
    return () => { if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current); };
  }, [cityInput]);

  // Dismiss dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCitySuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const addCity = (s: DestinationSuggestion) => {
    if (selectedCities.some((c) => c.placeId === s.placeId)) return;
    setSelectedCities((prev) => [...prev, s]);
    setCityInput("");
    setCitySuggestions([]);
    setCitySuggestOpen(false);
  };

  const removeCity = (placeId: string) => {
    setSelectedCities((prev) => prev.filter((c) => c.placeId !== placeId));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedCities.length === 0 || !startDate || !endDate) {
      setError("Please add at least one city and fill in the dates.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cities: selectedCities.map((c) => c.cityName),
          country: selectedCities[0].countryName,
          countries: Array.from(new Set(selectedCities.map((c) => c.countryName))),
          startDate,
          endDate,
        }),
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

          {/* City chip multi-add */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>Where are you going?</label>
            <div ref={dropdownRef} style={{ position: "relative" }}>
              <input
                type="text"
                value={cityInput}
                onChange={(e) => { setCityInput(e.target.value); setCitySuggestOpen(true); }}
                onFocus={(e) => { setCitySuggestOpen(true); e.currentTarget.style.borderColor = "#C4664A"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }}
                placeholder="Add a city"
                autoFocus={selectedCities.length === 0}
                style={inputStyle}
              />
              {citySuggestOpen && citySuggestions.length > 0 && (
                <ul style={{
                  position: "absolute",
                  zIndex: 20,
                  left: 0,
                  right: 0,
                  marginTop: "4px",
                  backgroundColor: "#fff",
                  border: "1px solid #E5E7EB",
                  borderRadius: "12px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  maxHeight: "240px",
                  overflowY: "auto",
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                }}>
                  {citySuggestions.map((s) => (
                    <li key={s.placeId}>
                      <button
                        type="button"
                        onMouseDown={() => addCity(s)}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 14px",
                          fontSize: "14px",
                          color: "#1B3A5C",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F9F9F9"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                      >
                        <span style={{ fontWeight: 600 }}>{s.cityName}{s.region && s.region !== s.countryName ? `, ${s.region}` : ""}</span>
                        {s.countryName && <span style={{ color: "#717171", marginLeft: 6 }}>{s.countryName}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p style={{ fontSize: "12px", color: "#9CA3AF", fontStyle: "italic", margin: 0 }}>
              For multi-stop trips, add multiple cities.
            </p>

            {selectedCities.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                {selectedCities.map((c) => (
                  <span
                    key={c.placeId}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 12px",
                      borderRadius: "999px",
                      backgroundColor: "#1B3A5C",
                      color: "#fff",
                      fontSize: "13px",
                      fontWeight: 500,
                    }}
                  >
                    {c.cityName}
                    <button
                      type="button"
                      onClick={() => removeCity(c.placeId)}
                      aria-label={`Remove ${c.cityName}`}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: "14px",
                        lineHeight: 1,
                        padding: "0 0 0 2px",
                        opacity: 0.8,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {selectedCities.length > 0 && (() => {
              const uniqueCountries = Array.from(new Set(selectedCities.map((c) => c.countryName).filter(Boolean)));
              const label = uniqueCountries.length === 1 ? "Country" : "Countries";
              return (
                <p style={{ fontSize: "12px", color: "#717171", margin: 0 }}>
                  {label}: {uniqueCountries.join(", ") || "—"}
                </p>
              );
            })()}
          </div>

          {/* Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate && endDate < e.target.value) setEndDate(e.target.value);
                }}
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
            disabled={loading || selectedCities.length === 0 || !startDate || !endDate}
            style={{
              marginTop: "4px",
              padding: "14px",
              borderRadius: "999px",
              backgroundColor: "#C4664A",
              color: "#fff",
              fontWeight: 700,
              fontSize: "15px",
              border: "none",
              cursor: (loading || selectedCities.length === 0 || !startDate || !endDate) ? "not-allowed" : "pointer",
              opacity: (loading || selectedCities.length === 0 || !startDate || !endDate) ? 0.7 : 1,
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
