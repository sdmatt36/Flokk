"use client";

import { useState, useEffect } from "react";

const FREQUENCY_OPTIONS = [
  { value: "ONE_TWO", label: "1–2x per year" },
  { value: "THREE_FIVE", label: "3–5x per year" },
  { value: "SIX_PLUS", label: "6+ per year" },
];

interface FamilyProfileData {
  familyName: string;
  homeCity: string;
  homeCountry: string;
  travelFrequency: string;
  accessibilityNotes: string;
}

const INTEREST_CATEGORIES = [
  {
    label: "Food & Drink",
    tiles: [
      { key: "street_food", label: "Street food" },
      { key: "fine_dining", label: "Fine dining" },
      { key: "local_markets", label: "Local markets" },
      { key: "cooking_classes", label: "Cooking classes" },
      { key: "coffee_culture", label: "Coffee culture" },
      { key: "wine_spirits", label: "Wine & spirits" },
      { key: "food_tours", label: "Food tours" },
      { key: "farm_to_table", label: "Farm to table" },
    ],
  },
  {
    label: "Outdoor & Adventure",
    tiles: [
      { key: "hiking", label: "Hiking" },
      { key: "beach", label: "Beach" },
      { key: "surfing", label: "Surfing" },
      { key: "skiing", label: "Skiing & snowboarding" },
      { key: "cycling", label: "Cycling" },
      { key: "camping", label: "Camping" },
      { key: "water_sports", label: "Water sports" },
      { key: "rock_climbing", label: "Rock climbing" },
      { key: "national_parks", label: "National parks" },
      { key: "safari", label: "Safari" },
    ],
  },
  {
    label: "Culture & History",
    tiles: [
      { key: "museums", label: "Museums" },
      { key: "art_galleries", label: "Art galleries" },
      { key: "architecture", label: "Architecture" },
      { key: "historical_sites", label: "Historical sites" },
      { key: "local_festivals", label: "Local festivals" },
      { key: "theatre", label: "Theatre & performance" },
      { key: "religious_sites", label: "Religious sites" },
      { key: "unesco_sites", label: "UNESCO sites" },
    ],
  },
  {
    label: "Kids & Family",
    tiles: [
      { key: "theme_parks", label: "Theme parks" },
      { key: "zoos", label: "Zoos & aquariums" },
      { key: "science_centres", label: "Science centres" },
      { key: "kids_museums", label: "Kids museums" },
      { key: "playgrounds", label: "Playgrounds & parks" },
      { key: "water_parks", label: "Water parks" },
      { key: "wildlife_encounters", label: "Wildlife encounters" },
      { key: "hands_on_workshops", label: "Hands-on workshops" },
    ],
  },
  {
    label: "Entertainment",
    tiles: [
      { key: "live_music", label: "Live music" },
      { key: "sports_events", label: "Sports events" },
      { key: "nightlife", label: "Nightlife" },
      { key: "cinemas", label: "Cinemas" },
      { key: "comedy_shows", label: "Comedy shows" },
      { key: "escape_rooms", label: "Escape rooms" },
      { key: "gaming_arcades", label: "Gaming & arcades" },
      { key: "seasonal_events", label: "Seasonal events" },
    ],
  },
  {
    label: "Wellness & Relaxation",
    tiles: [
      { key: "spas", label: "Spa & wellness" },
      { key: "yoga", label: "Yoga & meditation" },
      { key: "hot_springs", label: "Hot springs" },
      { key: "slow_travel", label: "Slow travel" },
      { key: "scenic_drives", label: "Scenic drives" },
      { key: "luxury_stays", label: "Luxury stays" },
      { key: "private_beaches", label: "Private beaches" },
    ],
  },
  {
    label: "Shopping & Style",
    tiles: [
      { key: "boutiques", label: "Local boutiques" },
      { key: "markets_bazaars", label: "Markets & bazaars" },
      { key: "designer_shopping", label: "Designer shopping" },
      { key: "vintage", label: "Vintage & thrift" },
      { key: "artisan_crafts", label: "Artisan crafts" },
      { key: "bookshops", label: "Bookshops" },
    ],
  },
];

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid #E8E8E8",
  borderRadius: "8px",
  fontSize: "14px",
  color: "#1a1a1a",
  backgroundColor: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 500,
  color: "#1B3A5C",
  marginBottom: "6px",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: "12px",
  border: "1px solid #E8E8E8",
  padding: "24px",
};

// ── Interests card ──────────────────────────────────────────────────────────

function InterestsCard() {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/profile/interests")
      .then((r) => r.json())
      .then(({ interestKeys }) => {
        if (Array.isArray(interestKeys)) setSelectedKeys(new Set(interestKeys));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function toggle(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setError("");
  }

  async function handleSave() {
    const keys = Array.from(selectedKeys);
    if (keys.length < 3) {
      setError("Please select at least 3 interests to save.");
      return;
    }
    setError("");
    setSaving(true);
    const res = await fetch("/api/profile/interests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interestKeys: keys }),
    });
    setSaving(false);
    if (res.ok) {
      setToast(true);
      setTimeout(() => setToast(false), 2000);
    }
  }

  if (loading) return null;

  return (
    <div style={{ ...cardStyle, marginTop: "24px" }}>
      {toast && (
        <div style={{
          position: "fixed", top: "24px", left: "50%", transform: "translateX(-50%)",
          backgroundColor: "#C4664A", color: "#fff", fontSize: "13px", fontWeight: 600,
          padding: "8px 20px", borderRadius: "999px", zIndex: 9999, pointerEvents: "none",
          whiteSpace: "nowrap",
        }}>
          Interests saved
        </div>
      )}

      <p style={{ fontSize: "18px", fontWeight: 600, color: "#1B3A5C", margin: 0 }}>Travel interests</p>
      <p style={{ fontSize: "14px", color: "#717171", marginTop: "4px", marginBottom: "24px", lineHeight: 1.5 }}>
        Select everything that sounds like your family. The more you choose, the better your recommendations.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {INTEREST_CATEGORIES.map((cat) => (
          <div key={cat.label}>
            <p style={{
              fontSize: "11px", fontWeight: 600, color: "#717171",
              textTransform: "uppercase", letterSpacing: "0.08em",
              margin: "0 0 10px",
            }}>
              {cat.label}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {cat.tiles.map((tile) => {
                const active = selectedKeys.has(tile.key);
                return (
                  <button
                    key={tile.key}
                    onClick={() => toggle(tile.key)}
                    style={{
                      padding: "7px 16px", borderRadius: "999px", fontSize: "14px",
                      border: `1px solid ${active ? "#1B3A5C" : "#E8E8E8"}`,
                      backgroundColor: active ? "#1B3A5C" : "#fff",
                      color: active ? "#fff" : "#717171",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {tile.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p style={{ color: "#e53e3e", fontSize: "13px", marginTop: "16px", marginBottom: 0 }}>{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          backgroundColor: "#C4664A", color: "#fff", border: "none",
          borderRadius: "8px", padding: "9px 20px", fontSize: "14px",
          fontWeight: 500, cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1, marginTop: "24px",
        }}
      >
        {saving ? "Saving..." : `Save interests (${selectedKeys.size} selected)`}
      </button>
    </div>
  );
}

// ── Family details form ─────────────────────────────────────────────────────

export function FamilySection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [form, setForm] = useState<FamilyProfileData>({
    familyName: "",
    homeCity: "",
    homeCountry: "",
    travelFrequency: "",
    accessibilityNotes: "",
  });

  useEffect(() => {
    fetch("/api/family/profile")
      .then((r) => r.json())
      .then(({ familyProfile }) => {
        if (familyProfile) {
          setForm({
            familyName: familyProfile.familyName || "",
            homeCity: familyProfile.homeCity || "",
            homeCountry: familyProfile.homeCountry || "",
            travelFrequency: familyProfile.travelFrequency || "",
            accessibilityNotes: familyProfile.accessibilityNotes || "",
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    await fetch("/api/family/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  }

  function field(key: keyof FamilyProfileData) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  if (loading) return <p style={{ color: "#717171", fontSize: "14px" }}>Loading...</p>;

  return (
    <div>
      {toast && (
        <div style={{
          position: "fixed", top: "24px", left: "50%", transform: "translateX(-50%)",
          backgroundColor: "#1B3A5C", color: "#fff", fontSize: "13px", fontWeight: 600,
          padding: "8px 20px", borderRadius: "999px", zIndex: 9999, pointerEvents: "none",
          whiteSpace: "nowrap",
        }}>
          Changes saved
        </div>
      )}

      <div style={cardStyle}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label style={labelStyle}>Family name</label>
            <input style={fieldStyle} placeholder="The Greenes" {...field("familyName")} />
          </div>
          <div>
            <label style={labelStyle}>Home city</label>
            <input style={fieldStyle} placeholder="Kamakura" {...field("homeCity")} />
          </div>
          <div>
            <label style={labelStyle}>Home country</label>
            <input style={fieldStyle} placeholder="Japan" {...field("homeCountry")} />
          </div>
          <div>
            <label style={labelStyle}>Travel frequency</label>
            <select style={fieldStyle} {...field("travelFrequency")}>
              <option value="">Select...</option>
              {FREQUENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label style={labelStyle}>Accessibility needs</label>
            <textarea
              style={{ ...fieldStyle, resize: "vertical" }}
              rows={3}
              placeholder="Any mobility, sensory, or other accessibility needs we should know about"
              {...field("accessibilityNotes")}
            />
          </div>
        </div>

        <div style={{ marginTop: "20px" }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              backgroundColor: "#1B3A5C", color: "#fff", border: "none",
              borderRadius: "8px", padding: "9px 20px", fontSize: "14px",
              fontWeight: 500, cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      <InterestsCard />
    </div>
  );
}
