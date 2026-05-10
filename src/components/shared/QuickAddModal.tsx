"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";

type Tab = "pick" | "itinerary" | "tour";

interface QuickAddModalProps {
  isOpen: boolean;
  defaultTab?: Tab;
  prefillCity?: string;
  onClose: () => void;
}

interface CitySuggestion {
  city: string;
  country: string;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "pick", label: "+ Pick" },
  { id: "itinerary", label: "+ Itinerary" },
  { id: "tour", label: "+ Tour" },
];

function useCitySuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch(`/api/destinations/lookup?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then((d: { suggestions?: CitySuggestion[] }) => setSuggestions(d.suggestions ?? []))
        .catch(() => setSuggestions([]));
    }, 220);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  return suggestions;
}

export function QuickAddModal({ isOpen, defaultTab = "pick", prefillCity = "", onClose }: QuickAddModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  // Pick state
  const [pickTitle, setPickTitle] = useState("");
  const [pickCity, setPickCity] = useState(prefillCity);
  const [pickCategory, setPickCategory] = useState("");
  const [pickWebsite, setPickWebsite] = useState("");
  const [pickSubmitting, setPickSubmitting] = useState(false);
  const [pickDone, setPickDone] = useState(false);
  const [pickError, setPickError] = useState("");

  // Itinerary state
  const [itinDest, setItinDest] = useState(prefillCity);
  const [itinStart, setItinStart] = useState("");
  const [itinEnd, setItinEnd] = useState("");
  const [itinSubmitting, setItinSubmitting] = useState(false);
  const [itinShowSuggestions, setItinShowSuggestions] = useState(false);
  const itinSuggestions = useCitySuggestions(itinDest);

  // Tour state
  const [tourDest, setTourDest] = useState(prefillCity);
  const [tourShowSuggestions, setTourShowSuggestions] = useState(false);
  const tourSuggestions = useCitySuggestions(tourDest);

  // Reset per-tab state when switching tabs
  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setPickDone(false);
    setPickError("");
    setPickCategory("");
    setPickWebsite("");
  }

  // Sync prefillCity when it changes
  useEffect(() => {
    setPickCity(prefillCity);
    setItinDest(prefillCity);
    setTourDest(prefillCity);
  }, [prefillCity]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  if (!isOpen) return null;

  async function handlePickSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pickTitle.trim()) return;
    setPickSubmitting(true);
    setPickError("");
    try {
      const res = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceMethod: "URL_PASTE",
          title: pickTitle.trim(),
          city: pickCity.trim() || null,
          category: pickCategory || null,
          websiteUrl: pickWebsite.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setPickDone(true);
      setPickTitle("");
      setPickCity(prefillCity);
      setPickCategory("");
      setPickWebsite("");
    } catch {
      setPickError("Something went wrong. Try again.");
    } finally {
      setPickSubmitting(false);
    }
  }

  async function handleItinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!itinDest.trim()) return;
    setItinSubmitting(true);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: itinDest.trim(), startDate: itinStart || null, endDate: itinEnd || null }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as { tripId?: string; id?: string };
      const id = data.tripId ?? data.id;
      if (id) { onClose(); router.push(`/trips/${id}`); }
    } catch {
    } finally {
      setItinSubmitting(false);
    }
  }

  function handleTourSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tourDest.trim()) return;
    const parts = tourDest.split(",").map(s => s.trim());
    const city = parts[0] ?? tourDest.trim();
    const country = parts[1] ?? "";
    onClose();
    router.push(`/tour?city=${encodeURIComponent(city)}${country ? `&country=${encodeURIComponent(country)}` : ""}`);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 500, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: "#fff", borderRadius: "20px", width: "100%", maxWidth: "480px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid #F0F0F0" }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              style={{
                flex: 1, padding: "16px 8px", fontSize: "14px", fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? "#C4664A" : "#888",
                background: "none", border: "none", borderBottom: activeTab === tab.id ? "2px solid #C4664A" : "2px solid transparent",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={onClose}
            style={{ padding: "16px", background: "none", border: "none", cursor: "pointer", color: "#AAAAAA", display: "flex", alignItems: "center" }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "24px" }}>

          {/* ── PICK TAB ── */}
          {activeTab === "pick" && (
            pickDone ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <p style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", marginBottom: "6px" }}>Saved!</p>
                <p style={{ fontSize: "13px", color: "#888", marginBottom: "20px" }}>Find it in your Saves.</p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                  <button
                    onClick={() => setPickDone(false)}
                    style={{ padding: "10px 20px", borderRadius: "999px", border: "1px solid #E5E7EB", background: "#fff", fontSize: "13px", fontWeight: 600, color: "#1B3A5C", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Add another
                  </button>
                  <button
                    onClick={onClose}
                    style={{ padding: "10px 20px", borderRadius: "999px", backgroundColor: "#C4664A", color: "#fff", fontSize: "13px", fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePickSubmit}>
                <p style={{ fontSize: "13px", color: "#888", marginBottom: "20px" }}>Save a place, restaurant, activity, or spot.</p>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#1B3A5C", marginBottom: "6px" }}>
                  Place name <span style={{ color: "#C4664A" }}>*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Nishiki Market, Blue Lagoon, Le Comptoir..."
                  value={pickTitle}
                  onChange={e => setPickTitle(e.target.value)}
                  required
                  style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1px solid #E5E7EB", fontSize: "14px", color: "#1a1a1a", marginBottom: "14px", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }}
                />
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#1B3A5C", marginBottom: "6px" }}>
                  City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kyoto, Reykjavik..."
                  value={pickCity}
                  onChange={e => setPickCity(e.target.value)}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1px solid #E5E7EB", fontSize: "14px", color: "#1a1a1a", marginBottom: "14px", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }}
                />
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#1B3A5C", marginBottom: "6px" }}>
                  Category
                </label>
                <select
                  value={pickCategory}
                  onChange={e => setPickCategory(e.target.value)}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1px solid #E5E7EB", fontSize: "14px", color: pickCategory ? "#1a1a1a" : "#888", marginBottom: "14px", boxSizing: "border-box", outline: "none", fontFamily: "inherit", background: "#fff" }}
                >
                  <option value="">Select a category...</option>
                  {CATEGORIES.map(c => (
                    <option key={c.slug} value={c.slug}>{c.label}</option>
                  ))}
                </select>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#1B3A5C", marginBottom: "6px" }}>
                  Website
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={pickWebsite}
                  onChange={e => setPickWebsite(e.target.value)}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1px solid #E5E7EB", fontSize: "14px", color: "#1a1a1a", marginBottom: "20px", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }}
                />
                {pickError && <p style={{ fontSize: "13px", color: "#e53e3e", marginBottom: "12px" }}>{pickError}</p>}
                <button
                  type="submit"
                  disabled={pickSubmitting || !pickTitle.trim()}
                  style={{ width: "100%", padding: "13px", borderRadius: "999px", backgroundColor: pickSubmitting || !pickTitle.trim() ? "#E5E5E5" : "#C4664A", color: pickSubmitting || !pickTitle.trim() ? "#AAAAAA" : "#fff", fontSize: "14px", fontWeight: 700, border: "none", cursor: pickSubmitting || !pickTitle.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                >
                  {pickSubmitting ? "Saving..." : "Save place"}
                </button>
              </form>
            )
          )}

          {/* ── ITINERARY TAB ── */}
          {activeTab === "itinerary" && (
            <form onSubmit={handleItinSubmit}>
              <p style={{ fontSize: "13px", color: "#888", marginBottom: "20px" }}>Start a new trip plan.</p>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#1B3A5C", marginBottom: "6px" }}>
                Destination <span style={{ color: "#C4664A" }}>*</span>
              </label>
              <div style={{ position: "relative", marginBottom: "14px" }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Tokyo, Japan"
                  value={itinDest}
                  onChange={e => { setItinDest(e.target.value); setItinShowSuggestions(true); }}
                  onFocus={() => setItinShowSuggestions(true)}
                  required
                  style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1px solid #E5E7EB", fontSize: "14px", color: "#1a1a1a", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }}
                />
                {itinShowSuggestions && itinSuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "10px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 10, maxHeight: "180px", overflowY: "auto" }}>
                    {itinSuggestions.map((s, i) => (
                      <div
                        key={i}
                        onMouseDown={e => { e.preventDefault(); setItinDest(`${s.city}${s.country ? `, ${s.country}` : ""}`); setItinShowSuggestions(false); }}
                        style={{ padding: "10px 14px", fontSize: "13px", cursor: "pointer", color: "#1a1a1a", borderBottom: i < itinSuggestions.length - 1 ? "1px solid #F5F5F5" : "none" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "#FFF3EE"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
                      >
                        {s.city}{s.country ? `, ${s.country}` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#1B3A5C", marginBottom: "6px" }}>Start date</label>
                  <input type="date" value={itinStart} onChange={e => setItinStart(e.target.value)} style={{ width: "100%", padding: "11px 10px", borderRadius: "10px", border: "1px solid #E5E7EB", fontSize: "13px", color: "#1a1a1a", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#1B3A5C", marginBottom: "6px" }}>End date</label>
                  <input type="date" value={itinEnd} onChange={e => setItinEnd(e.target.value)} style={{ width: "100%", padding: "11px 10px", borderRadius: "10px", border: "1px solid #E5E7EB", fontSize: "13px", color: "#1a1a1a", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
                </div>
              </div>
              <button
                type="submit"
                disabled={itinSubmitting || !itinDest.trim()}
                style={{ width: "100%", padding: "13px", borderRadius: "999px", backgroundColor: itinSubmitting || !itinDest.trim() ? "#E5E5E5" : "#C4664A", color: itinSubmitting || !itinDest.trim() ? "#AAAAAA" : "#fff", fontSize: "14px", fontWeight: 700, border: "none", cursor: itinSubmitting || !itinDest.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}
              >
                {itinSubmitting ? "Creating..." : "Create itinerary"}
              </button>
            </form>
          )}

          {/* ── TOUR TAB ── */}
          {activeTab === "tour" && (
            <form onSubmit={handleTourSubmit}>
              <p style={{ fontSize: "13px", color: "#888", marginBottom: "20px" }}>Build a stop-by-stop tour for any city.</p>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#1B3A5C", marginBottom: "6px" }}>
                Destination <span style={{ color: "#C4664A" }}>*</span>
              </label>
              <div style={{ position: "relative", marginBottom: "20px" }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Lisbon, Portugal"
                  value={tourDest}
                  onChange={e => { setTourDest(e.target.value); setTourShowSuggestions(true); }}
                  onFocus={() => setTourShowSuggestions(true)}
                  required
                  style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1px solid #E5E7EB", fontSize: "14px", color: "#1a1a1a", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }}
                />
                {tourShowSuggestions && tourSuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "10px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 10, maxHeight: "180px", overflowY: "auto" }}>
                    {tourSuggestions.map((s, i) => (
                      <div
                        key={i}
                        onMouseDown={e => { e.preventDefault(); setTourDest(`${s.city}${s.country ? `, ${s.country}` : ""}`); setTourShowSuggestions(false); }}
                        style={{ padding: "10px 14px", fontSize: "13px", cursor: "pointer", color: "#1a1a1a", borderBottom: i < tourSuggestions.length - 1 ? "1px solid #F5F5F5" : "none" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "#FFF3EE"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
                      >
                        {s.city}{s.country ? `, ${s.country}` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={!tourDest.trim()}
                style={{ width: "100%", padding: "13px", borderRadius: "999px", backgroundColor: !tourDest.trim() ? "#E5E5E5" : "#C4664A", color: !tourDest.trim() ? "#AAAAAA" : "#fff", fontSize: "14px", fontWeight: 700, border: "none", cursor: !tourDest.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}
              >
                Build tour →
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
