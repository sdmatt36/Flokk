"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, MapPin } from "lucide-react";
import { MODAL_OVERLAY_CLASSES, MODAL_PANEL_CLASSES } from "@/lib/modal-classes";
import type { DestinationSuggestion } from "@/app/api/destinations/lookup/route";

type AiSuggestion = {
  name: string;
  country: string;
};

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
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Autocomplete
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Dismiss dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Fetch Places suggestions with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);

    if (destination.length < 2) {
      setSuggestions([]);
      setAiSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    setSuggestionsLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/destinations/lookup?q=${encodeURIComponent(destination)}`);
        const data: DestinationSuggestion[] = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setSuggestionsLoading(false);

        // AI fallback if Places returned nothing
        if (data.length === 0) {
          aiDebounceRef.current = setTimeout(async () => {
            try {
              const aiRes = await fetch("/api/destinations/ai-lookup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: destination }),
              });
              const aiData: AiSuggestion[] = await aiRes.json();
              setAiSuggestions(Array.isArray(aiData) ? aiData : []);
            } catch { /* ignore */ }
          }, 200);
        } else {
          setAiSuggestions([]);
        }
      } catch {
        setSuggestionsLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    };
  }, [destination]);

  function onDestinationChange(value: string) {
    setDestination(value);
    if (selectedPlaceId !== null) setSelectedPlaceId(null);
    setShowDropdown(true);
  }

  function selectSuggestion(cityName: string, countryName: string, placeId?: string) {
    const value = countryName ? `${cityName}, ${countryName}` : cityName;
    setDestination(value);
    setSelectedPlaceId(placeId ?? null);
    setSuggestions([]);
    setAiSuggestions([]);
    setShowDropdown(false);
  }

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
        body: JSON.stringify({ destination, startDate, endDate, isAnonymous, destinationPlaceId: selectedPlaceId ?? undefined }),
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

  const hasDropdown = showDropdown && (suggestions.length > 0 || aiSuggestions.length > 0);

  return (
    <div
      className={MODAL_OVERLAY_CLASSES}
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className={MODAL_PANEL_CLASSES}
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
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
            <div ref={dropdownRef} style={{ position: "relative" }}>
              <input
                type="text"
                value={destination}
                onChange={(e) => onDestinationChange(e.target.value)}
                onFocus={() => { if (destination.length >= 2) setShowDropdown(true); }}
                placeholder="e.g. Ninh Binh, Vietnam"
                autoComplete="off"
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
              {hasDropdown && (
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  backgroundColor: "#fff",
                  border: "1.5px solid #E5E5E5",
                  borderRadius: "12px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                  zIndex: 200,
                  overflow: "hidden",
                }}>
                  {suggestions.map((s) => (
                    <button
                      key={s.placeId}
                      type="button"
                      onMouseDown={() => selectSuggestion(s.cityName, s.countryName, s.placeId)}
                      style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                    >
                      <MapPin size={12} style={{ color: "#C4664A", flexShrink: 0 }} />
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>{s.displayLabel}</span>
                    </button>
                  ))}
                  {aiSuggestions.length > 0 && (
                    <>
                      <div style={{ padding: "4px 14px 2px", fontSize: "10px", fontWeight: 700, color: "#AAAAAA", textTransform: "uppercase", letterSpacing: "0.06em", borderTop: suggestions.length > 0 ? "1px solid #F0F0F0" : undefined }}>
                        AI suggested
                      </div>
                      {aiSuggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onMouseDown={() => selectSuggestion(s.name, s.country)}
                          style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                        >
                          <MapPin size={12} style={{ color: "#AAAAAA", flexShrink: 0 }} />
                          <span>
                            <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>{s.name}</span>
                            {s.country && (
                              <span style={{ fontSize: "12px", color: "#888", marginLeft: "6px" }}>· {s.country}</span>
                            )}
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
              {suggestionsLoading && destination.length >= 2 && suggestions.length === 0 && aiSuggestions.length === 0 && (
                <p style={{ position: "absolute", top: "calc(100% + 6px)", left: "14px", fontSize: "12px", color: "#AAAAAA" }}>
                  Searching...
                </p>
              )}
            </div>
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

          {/* Community sharing */}
          <div style={{ paddingTop: "4px", borderTop: "1px solid #F0F0F0" }}>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a", marginBottom: "4px" }}>Community sharing</p>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>Control how your name appears if this trip is shared with the Flokk community.</p>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={!isAnonymous}
                onChange={(e) => setIsAnonymous(!e.target.checked)}
                style={{ width: "16px", height: "16px", marginTop: "2px", accentColor: "#C4664A", cursor: "pointer", flexShrink: 0 }}
              />
              <div>
                <span style={{ fontSize: "13px", color: "#1a1a1a" }}>Show our family name on community trips</span>
                <p style={{ fontSize: "12px", color: "#AAAAAA", marginTop: "2px" }}>Off by default. When on, your family name appears on your trips in Discover.</p>
              </div>
            </label>
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
    </div>
  );
}
