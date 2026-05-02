"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, X, Star, Check, Plus, Upload } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";

// ── Types ─────────────────────────────────────────────────────────────────────

type LinkItem = {
  id: string;
  url: string;
  title: string;
  imageUrl: string | null;
  category: string;
  city: string;
  country: string;
  rating: number | null;
  note: string;
  checkIn: string;
  checkOut: string;
};

type ServiceItem = {
  id: string;
  name: string;
  serviceType: string;
  phone: string;
  whatsapp: string;
  rating: number;
  recommend: boolean;
  notes: string;
};

type TipItem = {
  id: string;
  category: string;
  label: string;
  content: string;
};

// ── Design tokens ──────────────────────────────────────────────────────────────

const NAVY = "#1B3A5C";
const TERRA = "#C4664A";
const MUTED = "#717171";

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
  fontFamily: "inherit",
};

const STEP_LABELS = ["Basics", "Links", "Services", "Tips", "Photos", "Share"];

const STAR_LABELS: Record<number, string> = {
  1: "Skip it",
  2: "It was fine",
  3: "Good, would return",
  4: "Really loved it",
  5: "Tell every family you know",
};

const TIP_PILLS = [
  { category: "secret", label: "Best kept secret" },
  { category: "mistake", label: "Biggest mistake" },
  { category: "kids", label: "With kids specifically" },
  { category: "worth_it", label: "Worth the money" },
  { category: "not_worth_it", label: "NOT worth the money" },
  { category: "would_return", label: "Would you go back?" },
];

const SERVICE_TYPES = ["driver", "guide", "translator", "other"];

const LINK_CATEGORIES = [
  { value: "hotel", label: "Hotel" },
  { value: "restaurant", label: "Restaurant" },
  { value: "activity", label: "Activity" },
  { value: "food", label: "Food" },
  { value: "culture", label: "Culture" },
  { value: "shopping", label: "Shopping" },
  { value: "transportation", label: "Transportation" },
  { value: "other", label: "Other" },
];

// ── Star rating component ──────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  size = 20,
}: {
  value: number | null;
  onChange: (v: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(null)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "2px" }}
        >
          <Star
            size={size}
            fill={(hover ?? value ?? 0) >= s ? TERRA : "none"}
            stroke={(hover ?? value ?? 0) >= s ? TERRA : "#CCCCCC"}
          />
        </button>
      ))}
      {(hover ?? value) && (
        <span style={{ fontSize: "12px", color: MUTED, marginLeft: "4px" }}>
          {STAR_LABELS[hover ?? value ?? 0]}
        </span>
      )}
    </div>
  );
}

// ── Step 1: Basics ─────────────────────────────────────────────────────────────

function Step1Basics({
  destinations,
  setDestinations,
  country,
  setCountry,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  title,
  setTitle,
  onContinue,
}: {
  destinations: { city: string }[];
  setDestinations: React.Dispatch<React.SetStateAction<{ city: string }[]>>;
  country: string;
  setCountry: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  title: string;
  setTitle: (v: string) => void;
  onContinue: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [showSuggestionsFor, setShowSuggestionsFor] = useState<number | null>(null);
  const [destSuggestions, setDestSuggestions] = useState<{cityName: string; countryName: string; region?: string; placeId?: string; displayLabel?: string}[][]>([[]]);
  const destDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const primaryCity = destinations[0]?.city ?? "";

  const computeAutoTitle = (dests: { city: string }[], date: string) => {
    const cities = dests.map((d) => d.city).filter(Boolean).join(" + ");
    return cities && date
      ? `${cities} ${new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" })}`
      : cities;
  };

  useEffect(() => {
    if (!titleManuallyEdited) {
      setTitle(computeAutoTitle(destinations, startDate));
    }
  }, [destinations, startDate, titleManuallyEdited]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateCity = (i: number, v: string) => {
    setDestinations((prev) => prev.map((d, idx) => idx === i ? { ...d, city: v } : d));
    if (destDebounceRef.current) clearTimeout(destDebounceRef.current);
    if (v.length < 2) {
      setDestSuggestions((prev) => { const next = [...prev]; next[i] = []; return next; });
      return;
    }
    destDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/destinations/lookup?q=${encodeURIComponent(v)}`);
        const data = await res.json();
        setDestSuggestions((prev) => { const next = [...prev]; next[i] = Array.isArray(data) ? data.slice(0, 8) : []; return next; });
      } catch {
        setDestSuggestions((prev) => { const next = [...prev]; next[i] = []; return next; });
      }
    }, 300);
  };

  const handleStartChange = (v: string) => {
    setStartDate(v);
  };

  const canContinue = primaryCity.trim() !== "" && startDate !== "" && endDate !== "";

  const handleClick = async () => {
    if (!canContinue) { setError("Please fill in destination and dates."); return; }
    setLoading(true);
    setError("");
    await onContinue();
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h2 style={{ fontSize: "22px", fontWeight: 800, color: NAVY, marginBottom: "6px" }}>Where did you go?</h2>
        <p style={{ fontSize: "14px", color: MUTED }}>Tell us about this trip</p>
      </div>

      {/* Multi-city destination inputs */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <label style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>Destination city *</label>
        {destinations.map((dest, i) => {
          const suggestions = destSuggestions[i] ?? [];
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
              {i > 0 && (
                <span style={{ fontSize: "11px", fontWeight: 700, color: MUTED, whiteSpace: "nowrap", minWidth: "48px", paddingTop: "14px" }}>
                  + stop {i + 1}
                </span>
              )}
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  type="text"
                  value={dest.city}
                  onChange={(e) => { updateCity(i, e.target.value); setShowSuggestionsFor(i); }}
                  onFocus={() => setShowSuggestionsFor(i)}
                  onBlur={() => setTimeout(() => setShowSuggestionsFor(null), 150)}
                  placeholder={i === 0 ? "e.g. Chiang Rai" : "e.g. Bangkok"}
                  style={{ ...inputStyle }}
                  onFocusCapture={(e) => { e.currentTarget.style.borderColor = TERRA; }}
                  onBlurCapture={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }}
                />
                {showSuggestionsFor === i && suggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, backgroundColor: "#fff", border: "1.5px solid #EEEEEE", borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", marginTop: "4px" }}>
                    {suggestions.map((s) => (
                      <button
                        key={s.placeId ?? `${s.cityName}-${s.countryName}`}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); updateCity(i, s.countryName ? `${s.cityName}, ${s.countryName}` : s.cityName); setShowSuggestionsFor(null); }}
                        style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #F5F5F5", cursor: "pointer", fontFamily: "inherit" }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FFF8F6"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; }}
                      >
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>{s.displayLabel ?? (s.countryName ? `${s.cityName}, ${s.countryName}` : s.cityName)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showSuggestionsFor === i && dest.city.length >= 2 && suggestions.length === 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, backgroundColor: "#fff", border: "1.5px solid #EEEEEE", borderRadius: "12px", padding: "10px 14px", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", marginTop: "4px" }}>
                    <span style={{ fontSize: "13px", color: MUTED }}>No suggestions — type your city name</span>
                  </div>
                )}
              </div>
              {i > 0 && (
                <button type="button" onClick={() => setDestinations((prev) => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#CCC", padding: "4px", marginTop: "10px" }}>
                  <X size={15} />
                </button>
              )}
            </div>
          );
        })}
        {destinations.length < 6 && (
          <button
            type="button"
            onClick={() => setDestinations((prev) => [...prev, { city: "" }])}
            style={{ alignSelf: "flex-start", fontSize: "13px", fontWeight: 600, color: TERRA, background: "none", border: "none", cursor: "pointer", padding: "0", fontFamily: "inherit" }}
          >
            + Add another city
          </button>
        )}
      </div>

      {/* Country dropdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>Country</label>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          style={{ ...inputStyle, appearance: "auto" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = TERRA; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }}
        >
          <option value="">Select country…</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>Start date *</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleStartChange(e.target.value)}
            style={{ ...inputStyle, fontSize: "14px", padding: "12px" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = TERRA; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>End date *</label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ ...inputStyle, fontSize: "14px", padding: "12px" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = TERRA; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>Trip title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setTitleManuallyEdited(true); }}
          placeholder={computeAutoTitle(destinations, startDate) || "e.g. Chiang Rai + Bangkok May '25"}
          style={inputStyle}
          onFocus={(e) => { e.currentTarget.style.borderColor = TERRA; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }}
        />
        {!titleManuallyEdited && title && (
          <p style={{ fontSize: "12px", color: MUTED }}>Will be saved as &quot;{title}&quot;</p>
        )}
      </div>

      {error && <p style={{ fontSize: "13px", color: TERRA }}>{error}</p>}

      <button
        type="button"
        onClick={handleClick}
        disabled={loading || !canContinue}
        style={{ padding: "14px", borderRadius: "999px", backgroundColor: canContinue ? TERRA : "#E0E0E0", color: "#fff", fontWeight: 700, fontSize: "15px", border: "none", cursor: canContinue ? "pointer" : "not-allowed", fontFamily: "inherit" }}
      >
        {loading ? "Creating trip..." : "Continue →"}
      </button>
    </div>
  );
}

// ── Step 2: Links ──────────────────────────────────────────────────────────────

function Step2Links({
  tripId,
  destination,
  country,
  savedLinks,
  setSavedLinks,
  onContinue,
  onSkip,
}: {
  tripId: string;
  destination: string;
  country: string;
  savedLinks: LinkItem[];
  setSavedLinks: React.Dispatch<React.SetStateAction<LinkItem[]>>;
  onContinue: () => Promise<void>;
  onSkip: () => void;
}) {
  const [linkInput, setLinkInput] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleExtract = useCallback(async (url: string) => {
    if (!url.startsWith("http")) return;
    setIsExtracting(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      setSavedLinks((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          url,
          title: data.title ?? url,
          imageUrl: data.imageUrl ?? null,
          category: data.category ?? "other",
          city: data.city ?? destination,
          country: data.country ?? country,
          rating: null,
          note: "",
          checkIn: "",
          checkOut: "",
        },
      ]);
      setLinkInput("");
    } catch (err) {
      console.error("[extract]", err);
    } finally {
      setIsExtracting(false);
    }
  }, [destination, country, setSavedLinks]);

  const updateLink = (id: string, field: keyof LinkItem, value: string | number | null) => {
    setSavedLinks((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const removeLink = (id: string) => {
    setSavedLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const handleContinue = async () => {
    if (!tripId) {
      console.error("[past-trip] no tripId available for link saves");
      await onContinue();
      return;
    }
    setSaving(true);
    for (const link of savedLinks) {
      console.log("[Step2] tripId:", tripId);
      console.log("[Step2] link to save:", link);
      const fetchBody = {
        url: link.url,
        tripId,
        title: link.title,
        thumbnailUrl: link.imageUrl ?? undefined,
        tags: [link.category || "other"],
        userRating: link.rating ?? undefined,
        notes: link.note || undefined,
        extractedCheckin: link.checkIn || undefined,
        extractedCheckout: link.checkOut || undefined,
      };
      console.log("[Step2] fetch body:", JSON.stringify(fetchBody));
      try {
        const res = await fetch("/api/saves", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fetchBody),
        });
        console.log("[Step2] save response status:", res.status);
        const responseData = await res.json().catch(() => ({}));
        console.log("[Step2] save response:", responseData);
        if (!res.ok) {
          console.error("[past-trip] link save failed:", res.status, responseData);
        } else if (responseData.duplicate) {
          console.log("[past-trip] link already saved (duplicate):", link.title);
        }
      } catch (err) {
        console.error("[past-trip] link save network error:", err);
      }
    }
    setSaving(false);
    await onContinue();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h2 style={{ fontSize: "22px", fontWeight: 800, color: NAVY, marginBottom: "6px" }}>What did you book or love?</h2>
        <p style={{ fontSize: "14px", color: MUTED }}>Paste links to your hotel, activities, restaurants — anything you want to share.</p>
      </div>

      {/* URL input */}
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="url"
          value={linkInput}
          onChange={(e) => setLinkInput(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (pasted.startsWith("http")) {
              setTimeout(() => handleExtract(pasted), 100);
            }
          }}
          placeholder="Paste a URL…"
          style={{ ...inputStyle, flex: 1 }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleExtract(linkInput); } }}
          onFocus={(e) => { e.currentTarget.style.borderColor = TERRA; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }}
        />
        {linkInput.length > 0 && (
          <button
            type="button"
            onClick={() => handleExtract(linkInput)}
            disabled={isExtracting || !linkInput.startsWith("http")}
            style={{ padding: "12px 16px", borderRadius: "12px", backgroundColor: TERRA, color: "#fff", fontWeight: 600, fontSize: "14px", border: "none", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", opacity: isExtracting || !linkInput.startsWith("http") ? 0.5 : 1 }}
          >
            {isExtracting ? "Loading…" : "Extract →"}
          </button>
        )}
      </div>

      {/* Link cards */}
      {savedLinks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {savedLinks.map((link) => (
            <div key={link.id} style={{ backgroundColor: "#F9F9F9", borderRadius: "14px", border: "1px solid #EEEEEE", overflow: "hidden" }}>
              <div style={{ display: "flex", gap: "12px", padding: "12px 14px" }}>
                {link.imageUrl && (
                  <img src={link.imageUrl} alt="" style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "8px", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {(!link.title || link.title.startsWith("http")) ? (
                    <input
                      type="text"
                      value={link.title?.startsWith("http") ? "" : (link.title ?? "")}
                      onChange={(e) => updateLink(link.id, "title", e.target.value)}
                      placeholder="Type the hotel or place name…"
                      style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", borderBottom: "1.5px solid #EEEEEE", borderTop: "none", borderLeft: "none", borderRight: "none", width: "100%", paddingBottom: "4px", marginBottom: "4px", outline: "none", backgroundColor: "transparent", fontFamily: "inherit" }}
                      onFocus={(e) => { e.currentTarget.style.borderBottomColor = TERRA; }}
                      onBlur={(e) => { e.currentTarget.style.borderBottomColor = "#EEEEEE"; }}
                    />
                  ) : (
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.title}</p>
                  )}
                  <select
                    value={link.category}
                    onChange={(e) => updateLink(link.id, "category", e.target.value)}
                    style={{ fontSize: "11px", backgroundColor: "rgba(196,102,74,0.1)", color: TERRA, borderRadius: "6px", padding: "2px 8px", fontWeight: 500, border: "none", cursor: "pointer", fontFamily: "inherit", outline: "none" }}
                  >
                    {LINK_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={() => removeLink(link.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#CCC", flexShrink: 0, padding: "0 0 0 4px" }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <StarRating value={link.rating} onChange={(v) => updateLink(link.id, "rating", v)} />
                <input
                  type="text"
                  value={link.note}
                  onChange={(e) => updateLink(link.id, "note", e.target.value)}
                  placeholder="Add a one-line note…"
                  style={{ ...inputStyle, fontSize: "13px", padding: "8px 12px" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = TERRA; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }}
                />
                {(link.category === "hotel" || link.category === "accommodation") && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", fontWeight: 600, color: MUTED }}>Check-in</label>
                      <input
                        type="date"
                        value={link.checkIn}
                        onChange={(e) => {
                          updateLink(link.id, "checkIn", e.target.value);
                          if (!link.checkOut) updateLink(link.id, "checkOut", e.target.value);
                        }}
                        style={{ ...inputStyle, fontSize: "13px", padding: "8px 12px" }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = TERRA; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", fontWeight: 600, color: MUTED }}>Check-out</label>
                      <input
                        type="date"
                        value={link.checkOut}
                        onChange={(e) => updateLink(link.id, "checkOut", e.target.value)}
                        style={{ ...inputStyle, fontSize: "13px", padding: "8px 12px" }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = TERRA; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px" }}>
        <button
          type="button"
          onClick={handleContinue}
          disabled={saving}
          style={{ flex: 1, padding: "14px", borderRadius: "999px", backgroundColor: TERRA, color: "#fff", fontWeight: 700, fontSize: "15px", border: "none", cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving…" : `Continue${savedLinks.length > 0 ? ` (${savedLinks.length} saved)` : ""} →`}
        </button>
        <button type="button" onClick={onSkip} style={{ padding: "14px 20px", borderRadius: "999px", backgroundColor: "#F0F0F0", color: MUTED, fontWeight: 600, fontSize: "15px", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          Skip →
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Services ───────────────────────────────────────────────────────────

function Step3Services({
  tripId,
  services,
  setServices,
  onContinue,
  onSkip,
}: {
  tripId: string;
  services: ServiceItem[];
  setServices: React.Dispatch<React.SetStateAction<ServiceItem[]>>;
  onContinue: () => Promise<void>;
  onSkip: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<ServiceItem, "id">>({ name: "", serviceType: "driver", phone: "", whatsapp: "", rating: 0, recommend: true, notes: "" });
  const [saving, setSaving] = useState(false);

  const addService = () => {
    if (!form.name.trim()) return;
    setServices((prev) => [...prev, { ...form, id: crypto.randomUUID() }]);
    setForm({ name: "", serviceType: "driver", phone: "", whatsapp: "", rating: 0, recommend: true, notes: "" });
    setShowForm(false);
  };

  const removeService = (id: string) => setServices((prev) => prev.filter((s) => s.id !== id));

  const handleContinue = async () => {
    setSaving(true);
    for (const svc of services) {
      console.log("[past-trip] saving service with tripId:", tripId);
      try {
        const res = await fetch(`/api/trips/${tripId}/services`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: svc.name, serviceType: svc.serviceType, phone: svc.phone || null, whatsapp: svc.whatsapp || null, rating: svc.rating || null, recommend: svc.recommend, notes: svc.notes || null }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("[past-trip] service save failed:", res.status, err);
        }
      } catch (err) {
        console.error("[past-trip] service save network error:", err);
      }
    }
    setSaving(false);
    await onContinue();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h2 style={{ fontSize: "22px", fontWeight: 800, color: NAVY, marginBottom: "6px" }}>Did you hire anyone?</h2>
        <p style={{ fontSize: "14px", color: MUTED }}>A driver, tour guide, translator? These are the most valuable recommendations you can share.</p>
      </div>

      {/* Service cards */}
      {services.map((svc) => (
        <div key={svc.id} style={{ backgroundColor: "#F9F9F9", borderRadius: "14px", border: "1px solid #EEEEEE", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "4px" }}>{svc.name}</p>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", backgroundColor: "rgba(27,58,92,0.1)", color: NAVY, borderRadius: "6px", padding: "2px 8px", fontWeight: 600, textTransform: "capitalize" }}>{svc.serviceType}</span>
                {svc.recommend && <span style={{ fontSize: "11px", backgroundColor: "rgba(107,143,113,0.15)", color: "#6B8F71", borderRadius: "6px", padding: "2px 8px", fontWeight: 600 }}>Recommended</span>}
              </div>
              {svc.phone && <p style={{ fontSize: "12px", color: MUTED, marginTop: "4px" }}>{svc.phone}</p>}
              {svc.rating > 0 && (
                <div style={{ display: "flex", gap: "2px", marginTop: "6px" }}>
                  {[1,2,3,4,5].map((s) => <Star key={s} size={13} fill={svc.rating >= s ? TERRA : "none"} stroke={svc.rating >= s ? TERRA : "#CCC"} />)}
                </div>
              )}
            </div>
            <button type="button" onClick={() => removeService(svc.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#CCC" }}>
              <X size={16} />
            </button>
          </div>
        </div>
      ))}

      {/* Add form */}
      {showForm ? (
        <div style={{ backgroundColor: "#F9F9F9", borderRadius: "14px", border: "1px solid #E0E0E0", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name *" style={inputStyle} onFocus={(e) => { e.currentTarget.style.borderColor = TERRA; }} onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }} />
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {SERVICE_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, serviceType: t }))} style={{ padding: "6px 14px", borderRadius: "999px", border: form.serviceType === t ? "none" : "1.5px solid #E0E0E0", backgroundColor: form.serviceType === t ? NAVY : "#fff", color: form.serviceType === t ? "#fff" : MUTED, fontSize: "13px", fontWeight: 600, cursor: "pointer", textTransform: "capitalize", fontFamily: "inherit" }}>
                {t}
              </button>
            ))}
          </div>
          <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" style={inputStyle} onFocus={(e) => { e.currentTarget.style.borderColor = TERRA; }} onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }} />
          <input type="text" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} placeholder="WhatsApp" style={inputStyle} onFocus={(e) => { e.currentTarget.style.borderColor = TERRA; }} onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }} />
          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a", marginBottom: "6px" }}>Rating</p>
            <StarRating value={form.rating || null} onChange={(v) => setForm((f) => ({ ...f, rating: v }))} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input type="checkbox" checked={form.recommend} onChange={(e) => setForm((f) => ({ ...f, recommend: e.target.checked }))} style={{ width: "16px", height: "16px", accentColor: TERRA }} />
            <span style={{ fontSize: "13px", color: "#1a1a1a" }}>Recommend to other families</span>
          </label>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" rows={2} style={{ ...inputStyle, resize: "vertical" }} onFocus={(e) => { e.currentTarget.style.borderColor = TERRA; }} onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }} />
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={addService} disabled={!form.name.trim()} style={{ flex: 1, padding: "12px", borderRadius: "999px", backgroundColor: form.name.trim() ? NAVY : "#E0E0E0", color: "#fff", fontWeight: 700, fontSize: "14px", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Add →</button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: "12px 16px", borderRadius: "999px", backgroundColor: "#F0F0F0", color: MUTED, fontWeight: 600, fontSize: "14px", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "12px 16px", borderRadius: "12px", border: "1.5px dashed #CCC", backgroundColor: "transparent", color: MUTED, fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          <Plus size={16} /> Add person
        </button>
      )}

      <div style={{ display: "flex", gap: "12px" }}>
        <button type="button" onClick={handleContinue} disabled={saving} style={{ flex: 1, padding: "14px", borderRadius: "999px", backgroundColor: TERRA, color: "#fff", fontWeight: 700, fontSize: "15px", border: "none", cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : `Continue${services.length > 0 ? ` (${services.length})` : ""} →`}
        </button>
        <button type="button" onClick={onSkip} style={{ padding: "14px 20px", borderRadius: "999px", backgroundColor: "#F0F0F0", color: MUTED, fontWeight: 600, fontSize: "15px", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Skip →</button>
      </div>
    </div>
  );
}

// ── Step 4: Tips ───────────────────────────────────────────────────────────────

function Step4Tips({
  tripId,
  tips,
  setTips,
  onContinue,
  onSkip,
}: {
  tripId: string;
  tips: TipItem[];
  setTips: React.Dispatch<React.SetStateAction<TipItem[]>>;
  onContinue: () => Promise<void>;
  onSkip: () => void;
}) {
  const [activePill, setActivePill] = useState<{ category: string; label: string } | null>(null);
  const [tipInput, setTipInput] = useState("");
  const [saving, setSaving] = useState(false);

  const addTip = () => {
    if (!tipInput.trim() || !activePill) return;
    setTips((prev) => [...prev, { id: crypto.randomUUID(), category: activePill.category, label: activePill.label, content: tipInput.trim() }]);
    setTipInput("");
    setActivePill(null);
  };

  const removeTip = (id: string) => setTips((prev) => prev.filter((t) => t.id !== id));

  const handleContinue = async () => {
    setSaving(true);
    for (const tip of tips) {
      console.log("[past-trip] saving tip with tripId:", tripId);
      try {
        const res = await fetch(`/api/trips/${tripId}/tips`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: tip.category, content: tip.content }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("[past-trip] tip save failed:", res.status, err);
        }
      } catch (err) {
        console.error("[past-trip] tip save network error:", err);
      }
    }
    setSaving(false);
    await onContinue();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h2 style={{ fontSize: "22px", fontWeight: 800, color: NAVY, marginBottom: "6px" }}>What do you wish you&apos;d known?</h2>
        <p style={{ fontSize: "14px", color: MUTED }}>Your hard-won knowledge helps every family planning this destination after you.</p>
      </div>

      {/* Category pills */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {TIP_PILLS.map((p) => (
          <button
            key={p.category}
            type="button"
            onClick={() => { setActivePill(p); setTipInput(""); }}
            style={{ padding: "8px 14px", borderRadius: "999px", border: activePill?.category === p.category ? "none" : "1.5px solid #E0E0E0", backgroundColor: activePill?.category === p.category ? NAVY : "#fff", color: activePill?.category === p.category ? "#fff" : MUTED, fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            {p.label}
          </button>
        ))}
        <button type="button" onClick={() => setActivePill({ category: "general", label: "Something else" })} style={{ padding: "8px 14px", borderRadius: "999px", border: activePill?.category === "general" ? "none" : "1.5px solid #E0E0E0", backgroundColor: activePill?.category === "general" ? NAVY : "#fff", color: activePill?.category === "general" ? "#fff" : MUTED, fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Something else →
        </button>
      </div>

      {/* Tip input */}
      {activePill && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", backgroundColor: "#F9F9F9", borderRadius: "12px", padding: "14px", border: "1px solid #EEEEEE" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.06em" }}>{activePill.label}</p>
          <textarea
            value={tipInput}
            onChange={(e) => setTipInput(e.target.value)}
            placeholder="Share your experience…"
            rows={3}
            autoFocus
            style={{ ...inputStyle, resize: "vertical" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = TERRA; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={addTip} disabled={!tipInput.trim()} style={{ flex: 1, padding: "10px", borderRadius: "999px", backgroundColor: tipInput.trim() ? TERRA : "#E0E0E0", color: "#fff", fontWeight: 700, fontSize: "14px", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Add tip →</button>
            <button type="button" onClick={() => { setActivePill(null); setTipInput(""); }} style={{ padding: "10px 16px", borderRadius: "999px", backgroundColor: "#F0F0F0", color: MUTED, fontWeight: 600, fontSize: "14px", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Tip cards */}
      {tips.map((tip) => (
        <div key={tip.id} style={{ backgroundColor: "#F9F9F9", borderRadius: "12px", border: "1px solid #EEEEEE", padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "rgba(196,102,74,0.1)", color: TERRA, borderRadius: "6px", padding: "2px 8px", display: "inline-block", marginBottom: "6px" }}>{tip.label}</span>
              <p style={{ fontSize: "13px", color: "#1a1a1a", lineHeight: 1.5 }}>{tip.content}</p>
            </div>
            <button type="button" onClick={() => removeTip(tip.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#CCC", flexShrink: 0 }}>
              <X size={15} />
            </button>
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: "12px" }}>
        <button type="button" onClick={handleContinue} disabled={saving} style={{ flex: 1, padding: "14px", borderRadius: "999px", backgroundColor: TERRA, color: "#fff", fontWeight: 700, fontSize: "15px", border: "none", cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : `Continue${tips.length > 0 ? ` (${tips.length} tips)` : ""} →`}
        </button>
        <button type="button" onClick={onSkip} style={{ padding: "14px 20px", borderRadius: "999px", backgroundColor: "#F0F0F0", color: MUTED, fontWeight: 600, fontSize: "15px", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Skip →</button>
      </div>
    </div>
  );
}

// ── Step 5: Photos ─────────────────────────────────────────────────────────────

function Step5Photos({
  photos,
  setPhotos,
  onContinue,
  onSkip,
}: {
  photos: { file: File; url: string; isCover: boolean }[];
  setPhotos: React.Dispatch<React.SetStateAction<{ file: File; url: string; isCover: boolean }[]>>;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files).slice(0, 10 - photos.length);
    const newPhotos = incoming.map((file, i) => ({ file, url: URL.createObjectURL(file), isCover: photos.length === 0 && i === 0 }));
    setPhotos((prev) => [...prev, ...newPhotos]);
  };

  const makeCover = (idx: number) => {
    setPhotos((prev) => prev.map((p, i) => ({ ...p, isCover: i === idx })));
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (prev[idx]?.isCover && next.length > 0) next[0].isCover = true;
      return next;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h2 style={{ fontSize: "22px", fontWeight: 800, color: NAVY, marginBottom: "6px" }}>Add a few photos</h2>
        <p style={{ fontSize: "14px", color: MUTED }}>Help families see what this trip actually looks like.</p>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        style={{ border: "2px dashed #D0D0D0", borderRadius: "16px", padding: "32px 24px", textAlign: "center", cursor: "pointer", backgroundColor: "#FAFAFA" }}
      >
        <Upload size={28} style={{ color: MUTED, display: "block", margin: "0 auto 10px" }} />
        <p style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a1a", marginBottom: "4px" }}>Click or drag photos here</p>
        <p style={{ fontSize: "12px", color: MUTED }}>Up to {10 - photos.length} more photos</p>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {/* Thumbnails */}
      {photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: "relative", borderRadius: "10px", overflow: "hidden", aspectRatio: "1", border: p.isCover ? `2px solid ${TERRA}` : "2px solid transparent" }}>
              <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {p.isCover && (
                <span style={{ position: "absolute", bottom: "4px", left: "4px", fontSize: "10px", fontWeight: 700, backgroundColor: TERRA, color: "#fff", borderRadius: "4px", padding: "2px 6px" }}>Cover</span>
              )}
              <button type="button" onClick={() => makeCover(i)} style={{ position: "absolute", top: "4px", left: "4px", fontSize: "10px", background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: "4px", padding: "2px 5px", cursor: "pointer", display: p.isCover ? "none" : "block", fontFamily: "inherit" }}>Cover</button>
              <button type="button" onClick={() => removePhoto(i)} style={{ position: "absolute", top: "4px", right: "4px", background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: "12px", color: MUTED, backgroundColor: "#FFF8F6", borderRadius: "8px", padding: "10px 12px", border: "1px solid rgba(196,102,74,0.15)" }}>
        Photos will upload when you publish. Photos are optional but make your trip 4× more likely to be saved by other families.
      </p>

      <div style={{ display: "flex", gap: "12px" }}>
        <button type="button" onClick={onContinue} style={{ flex: 1, padding: "14px", borderRadius: "999px", backgroundColor: TERRA, color: "#fff", fontWeight: 700, fontSize: "15px", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          {photos.length > 0 ? `Continue (${photos.length} photos) →` : "Continue →"}
        </button>
        <button type="button" onClick={onSkip} style={{ padding: "14px 20px", borderRadius: "999px", backgroundColor: "#F0F0F0", color: MUTED, fontWeight: 600, fontSize: "15px", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Skip →</button>
      </div>
    </div>
  );
}

// ── Step 6: Share ──────────────────────────────────────────────────────────────

function Step6Share({
  tripId,
  destination,
  startDate,
  endDate,
  savedLinks,
  services,
  tips,
  photos,
  onPublish,
}: {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  savedLinks: LinkItem[];
  services: ServiceItem[];
  tips: TipItem[];
  photos: { file: File; url: string; isCover: boolean }[];
  onPublish: (privacy: string) => Promise<void>;
}) {
  const [visibility, setVisibility] = useState<"PRIVATE" | "NETWORK" | "PUBLIC">("PUBLIC");
  const [publishing, setPublishing] = useState(false);

  const calculatePoints = () => {
    let pts = 100;
    pts += savedLinks.length * 10;
    pts += services.length * 25;
    pts += tips.length * 15;
    if (photos.length > 0) pts += 50;
    return pts;
  };

  const handlePublish = async () => {
    setPublishing(true);
    await onPublish(visibility);
    setPublishing(false);
  };

  const PRIVACY_OPTIONS = [
    { value: "PRIVATE" as const, label: "Private", desc: "Only you can see this trip" },
    { value: "NETWORK" as const, label: "Share link", desc: "Anyone with the link can view" },
    { value: "PUBLIC" as const, label: "Flokk community", desc: "Visible to all families — recommended" },
  ];

  const formatDate = (d: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", d: "numeric", year: "numeric" } as Intl.DateTimeFormatOptions) : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h2 style={{ fontSize: "22px", fontWeight: 800, color: NAVY, marginBottom: "6px" }}>Ready to share?</h2>
        <p style={{ fontSize: "14px", color: MUTED }}>Your trip helps families planning this destination.</p>
      </div>

      {/* Summary */}
      <div style={{ backgroundColor: "#F9F9F9", borderRadius: "14px", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "8px", border: "1px solid #EEEEEE" }}>
        <SummaryRow label={`${destination}${startDate ? `, ${formatDate(startDate)}–${formatDate(endDate)}` : ""}`} />
        <SummaryRow label={`${savedLinks.length} link${savedLinks.length !== 1 ? "s" : ""} saved`} dim={savedLinks.length === 0} />
        <SummaryRow label={services.length > 0 ? `${services.length} service${services.length !== 1 ? "s" : ""} shared` : "No services added"} dim={services.length === 0} />
        <SummaryRow label={tips.length > 0 ? `${tips.length} tip${tips.length !== 1 ? "s" : ""} shared` : "No tips added"} dim={tips.length === 0} />
        <SummaryRow label={photos.length > 0 ? `${photos.length} photo${photos.length !== 1 ? "s" : ""}` : "No photos added"} dim={photos.length === 0} />
      </div>

      {/* Points */}
      <div style={{ backgroundColor: "rgba(27,58,92,0.05)", borderRadius: "14px", padding: "16px 18px", textAlign: "center", border: "1px solid rgba(27,58,92,0.1)" }}>
        <p style={{ fontSize: "28px", fontWeight: 900, color: NAVY, fontFamily: "'Playfair Display', Georgia, serif" }}>+{calculatePoints()} pts</p>
        <p style={{ fontSize: "13px", color: MUTED, marginTop: "4px" }}>Added to your Pioneer tier progress</p>
      </div>

      {/* Visibility */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>Who can see this?</p>
        {PRIVACY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setVisibility(opt.value)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: "12px", border: `1.5px solid ${visibility === opt.value ? NAVY : "#E0E0E0"}`, backgroundColor: visibility === opt.value ? "rgba(27,58,92,0.04)" : "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%" }}
          >
            <div>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px" }}>{opt.label}</p>
              <p style={{ fontSize: "12px", color: MUTED }}>{opt.desc}</p>
            </div>
            {visibility === opt.value && <Check size={18} style={{ color: NAVY, flexShrink: 0 }} />}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handlePublish}
        disabled={publishing}
        style={{ padding: "16px", borderRadius: "999px", backgroundColor: TERRA, color: "#fff", fontWeight: 700, fontSize: "16px", border: "none", cursor: "pointer", fontFamily: "inherit", opacity: publishing ? 0.7 : 1 }}
      >
        {publishing ? "Publishing…" : "Publish trip →"}
      </button>
    </div>
  );
}

function SummaryRow({ label, dim = false }: { label: string; dim?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <Check size={14} style={{ color: dim ? "#CCC" : "#6B8F71", flexShrink: 0 }} />
      <span style={{ fontSize: "13px", color: dim ? "#AAAAAA" : "#1a1a1a" }}>{label}</span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function PastTripBuilderForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const preDestination = searchParams.get("destination") ?? "";
  const preCountry = searchParams.get("country") ?? "";

  const [step, setStep] = useState(1);
  const [tripId, setTripId] = useState<string | null>(null);

  // Step 1
  const [destinations, setDestinations] = useState<{ city: string }[]>([{ city: preDestination }]);
  const [country, setCountry] = useState(preCountry);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [title, setTitle] = useState("");

  // Step 2
  const [savedLinks, setSavedLinks] = useState<LinkItem[]>([]);

  // Step 3
  const [services, setServices] = useState<ServiceItem[]>([]);

  // Step 4
  const [tips, setTips] = useState<TipItem[]>([]);

  // Step 5
  const [photos, setPhotos] = useState<{ file: File; url: string; isCover: boolean }[]>([]);

  const calculatePoints = () => {
    let pts = tripId ? 100 : 0;
    pts += savedLinks.length * 10;
    pts += services.length * 25;
    pts += tips.length * 15;
    if (photos.length > 0) pts += 50;
    return pts;
  };

  const handleStep1Continue = async () => {
    const cityString = destinations.map((d) => d.city).filter(Boolean).join(" + ");
    const finalTitle =
      title.trim() ||
      (cityString && startDate
        ? `${cityString} ${new Date(startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" })}`
        : cityString);

    const firstCity = destinations[0]?.city || cityString;
    const destinationParam = country ? `${firstCity}, ${country}` : firstCity;

    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: destinationParam,
        startDate: new Date(startDate + "T12:00:00").toISOString(),
        endDate: new Date(endDate + "T12:00:00").toISOString(),
        status: "COMPLETED",
      }),
    });
    const data = await res.json();
    if (data.tripId) {
      setTripId(data.tripId);
      // Always patch title since it includes multi-city names
      await fetch(`/api/trips/${data.tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: finalTitle }),
      });
    }
    setStep(2);
  };

  const handlePublish = async (privacy: string) => {
    if (!tripId) return;
    await fetch(`/api/trips/${tripId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privacy }),
    });
    router.push(`/trips/${tripId}`);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "80px" }}>
      <div style={{ maxWidth: "520px", margin: "0 auto", padding: "24px 20px 0" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <Link
            href="/trips?tab=past"
            style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13px", color: MUTED, textDecoration: "none" }}
          >
            <ChevronLeft size={15} /> Back
          </Link>
          <h1 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a" }}>Add a past trip</h1>
          {tripId ? (
            <span style={{ fontSize: "13px", fontWeight: 700, color: TERRA }}>+{calculatePoints()} pts</span>
          ) : (
            <div style={{ width: "48px" }} />
          )}
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div
                key={s}
                style={{ flex: 1, height: "4px", borderRadius: "2px", backgroundColor: s <= step ? TERRA : "#E8E8E8", transition: "background-color 0.3s" }}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {STEP_LABELS.map((label, i) => (
              <span
                key={label}
                style={{ fontSize: "10px", fontWeight: i + 1 === step ? 700 : 400, color: i + 1 === step ? NAVY : "#CCC", textAlign: "center", flex: 1 }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Step content */}
        {step === 1 && (
          <Step1Basics
            destinations={destinations}
            setDestinations={setDestinations}
            country={country}
            setCountry={setCountry}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            title={title}
            setTitle={setTitle}
            onContinue={handleStep1Continue}
          />
        )}
        {step === 2 && tripId && (
          <Step2Links
            tripId={tripId}
            destination={destinations.map((d) => d.city).filter(Boolean).join(" + ")}
            country={country}
            savedLinks={savedLinks}
            setSavedLinks={setSavedLinks}
            onContinue={async () => setStep(3)}
            onSkip={() => setStep(3)}
          />
        )}
        {step === 3 && tripId && (
          <Step3Services
            tripId={tripId}
            services={services}
            setServices={setServices}
            onContinue={async () => setStep(4)}
            onSkip={() => setStep(4)}
          />
        )}
        {step === 4 && tripId && (
          <Step4Tips
            tripId={tripId}
            tips={tips}
            setTips={setTips}
            onContinue={async () => setStep(5)}
            onSkip={() => setStep(5)}
          />
        )}
        {step === 5 && (
          <Step5Photos
            photos={photos}
            setPhotos={setPhotos}
            onContinue={() => setStep(6)}
            onSkip={() => setStep(6)}
          />
        )}
        {step === 6 && tripId && (
          <Step6Share
            tripId={tripId}
            destination={destinations.map((d) => d.city).filter(Boolean).join(" + ")}
            startDate={startDate}
            endDate={endDate}
            savedLinks={savedLinks}
            services={services}
            tips={tips}
            photos={photos}
            onPublish={handlePublish}
          />
        )}

      </div>
    </div>
  );
}

export default function PastTripBuilderPage() {
  return (
    <Suspense>
      <PastTripBuilderForm />
    </Suspense>
  );
}
