"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { searchAirports, getAirportByCode } from "@/lib/airports";

const FREQUENCY_OPTIONS = [
  { value: "ONE_TWO", label: "1–2x per year" },
  { value: "THREE_FIVE", label: "3–5x per year" },
  { value: "SIX_PLUS", label: "6+ per year" },
];

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
  "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma",
  "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming", "District of Columbia",
];
const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia","Austria","Azerbaijan",
  "Bahamas","Bahrain","Bangladesh","Belarus","Belgium","Belize","Bolivia","Bosnia & Herzegovina","Brazil","Bulgaria",
  "Cambodia","Canada","Chile","China","Colombia","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic",
  "Denmark","Dominican Republic","Ecuador","Egypt","El Salvador","Estonia","Ethiopia",
  "Finland","France","Georgia","Germany","Ghana","Greece","Guatemala","Honduras","Hungary",
  "Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy",
  "Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kuwait",
  "Latvia","Lebanon","Lithuania","Luxembourg","Malaysia","Mexico","Morocco","Myanmar",
  "Nepal","Netherlands","New Zealand","Nigeria","Norway",
  "Pakistan","Panama","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia",
  "Saudi Arabia","Senegal","Serbia","Singapore","Slovakia","Slovenia","South Africa","South Korea","Spain","Sri Lanka","Sweden","Switzerland",
  "Taiwan","Tanzania","Thailand","Tunisia","Turkey",
  "UAE","Ukraine","United Kingdom","United States","Uruguay","Uzbekistan",
  "Venezuela","Vietnam","Yemen","Zimbabwe",
];

interface FamilyProfileData {
  familyName: string;
  homeCity: string;
  state: string;
  homeCountry: string;
  favoriteAirports: string;
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
      { key: "family_kids", label: "Family & Kids" },
      { key: "kid_friendly", label: "Kid Friendly" },
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

const cardStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: "12px",
  border: "1px solid #E8E8E8",
  padding: "24px",
};

// ── Airport Picker ──────────────────────────────────────────────────────────

function AirportPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedCodes = value ? value.split(",").map((c) => c.trim()).filter(Boolean) : [];

  const filtered = query.length === 0 ? [] : searchAirports(query, 8).filter(
    (a) => !selectedCodes.includes(a.iata)
  );

  function addAirport(code: string) {
    if (selectedCodes.length >= 10) return;
    onChange([...selectedCodes, code].join(","));
    setQuery("");
    setOpen(false);
  }

  function removeAirport(code: string) {
    onChange(selectedCodes.filter((c) => c !== code).join(","));
  }

  const inputCls = "w-full border border-[#E8E8E8] rounded-lg px-3 py-2 text-sm text-[#1B3A5C] focus:outline-none focus:border-[#1B3A5C] bg-white";

  return (
    <div>
      {selectedCodes.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
          {selectedCodes.map((code) => {
            const airport = getAirportByCode(code);
            return (
              <span
                key={code}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  backgroundColor: "rgba(27,58,92,0.07)", color: "#1B3A5C",
                  fontSize: "12px", fontWeight: 600, padding: "4px 8px 4px 10px",
                  borderRadius: "999px", border: "1px solid rgba(27,58,92,0.15)",
                }}
              >
                <span>{code}</span>
                {airport && (
                  <span style={{ fontWeight: 400, color: "#717171" }}>· {airport.city}</span>
                )}
                <button
                  type="button"
                  onClick={() => removeAirport(code)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: "0 0 0 3px", lineHeight: 1, display: "flex", alignItems: "center",
                  }}
                >
                  <X size={11} style={{ color: "#717171" }} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {selectedCodes.length < 10 ? (
        <div style={{ position: "relative" }}>
          <input
            className={inputCls}
            placeholder="Search by code, city, or airport name..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 160)}
          />
          {open && filtered.length > 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
              backgroundColor: "#fff", border: "1px solid #E8E8E8", borderRadius: "8px",
              boxShadow: "0 6px 20px rgba(0,0,0,0.1)", zIndex: 200,
              maxHeight: "256px", overflowY: "auto",
            }}>
              {filtered.map((a, i) => (
                <button
                  key={a.iata}
                  type="button"
                  onMouseDown={() => addAirport(a.iata)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    width: "100%", padding: "10px 14px", border: "none",
                    background: "none", cursor: "pointer", textAlign: "left",
                    borderBottom: i < filtered.length - 1 ? "1px solid #F5F5F5" : "none",
                  }}
                >
                  <span style={{
                    fontSize: "12px", fontWeight: 700, color: "#fff",
                    backgroundColor: "#1B3A5C", padding: "2px 6px",
                    borderRadius: "4px", minWidth: "40px", textAlign: "center",
                    flexShrink: 0,
                  }}>
                    {a.iata}
                  </span>
                  <span style={{ fontSize: "13px", color: "#1a1a1a", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.name}
                  </span>
                  <span style={{ fontSize: "12px", color: "#717171", flexShrink: 0 }}>
                    {a.city}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p style={{ fontSize: "12px", color: "#717171", margin: 0 }}>Maximum of 10 airports selected.</p>
      )}
    </div>
  );
}

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
    state: "",
    homeCountry: "",
    favoriteAirports: "",
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
            state: familyProfile.state || "",
            homeCountry: familyProfile.homeCountry || "",
            favoriteAirports: familyProfile.favoriteAirports || "",
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

  function field(key: keyof Omit<FamilyProfileData, "favoriteAirports">) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  if (loading) return <p style={{ color: "#717171", fontSize: "14px" }}>Loading...</p>;

  const inputCls = "w-full border border-[#E8E8E8] rounded-lg px-3 py-2 text-sm text-[#1B3A5C] focus:outline-none focus:border-[#1B3A5C] bg-white";
  const labelCls = "block text-xs font-semibold text-[#717171] uppercase tracking-wide mb-1";

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        <div>
          <label className={labelCls}>Family name</label>
          <input className={inputCls} placeholder="The Greenes" {...field("familyName")} />
        </div>
        <div>
          <label className={labelCls}>Home city</label>
          <input className={inputCls} placeholder="Kamakura" {...field("homeCity")} />
        </div>
        <div>
          <label className={labelCls}>State</label>
          <select className={inputCls} {...field("state")}>
            <option value="" disabled>Select state...</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Home country</label>
          <select className={inputCls} {...field("homeCountry")}>
            <option value="">Select country...</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Travel frequency</label>
          <select className={inputCls} {...field("travelFrequency")}>
            <option value="">Select...</option>
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <label className={labelCls}>Favorite airport(s) <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— up to 10</span></label>
          <AirportPicker
            value={form.favoriteAirports}
            onChange={(v) => setForm((f) => ({ ...f, favoriteAirports: v }))}
          />
        </div>
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <label className={labelCls}>Accessibility needs</label>
          <textarea
            className={inputCls + " resize-y"}
            rows={2}
            placeholder="Any mobility, sensory, or other accessibility needs we should know about"
            {...field("accessibilityNotes")}
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          backgroundColor: "#1B3A5C", color: "#fff", border: "none",
          borderRadius: "8px", padding: "9px 24px", fontSize: "14px",
          fontWeight: 500, cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1, marginTop: "16px",
        }}
      >
        {saving ? "Saving..." : "Save changes"}
      </button>

      <SenderEmailsCard />
      <InterestsCard />
    </div>
  );
}

// ── Sender emails ─────────────────────────────────────────────────────────────

type PendingVerification = { id: string; email: string; createdAt: string };

function SenderEmailsCard() {
  const [emails, setEmails] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingVerification[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    fetch("/api/profile/sender-emails")
      .then((r) => r.json())
      .then((d: { senderEmails?: string[]; pending?: PendingVerification[] }) => {
        setEmails(d.senderEmails ?? []);
        setPending(d.pending ?? []);
      })
      .catch(() => {});
  }, []);

  async function handleAdd() {
    const e = newEmail.trim().toLowerCase();
    if (!e || !e.includes("@")) { setError("Enter a valid email address."); return; }
    setAdding(true);
    setError("");
    setSuccessMsg("");
    const res = await fetch("/api/profile/sender-emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", email: e }),
    });
    const d = await res.json() as { senderEmails?: string[]; pending?: PendingVerification[]; sent?: boolean; alreadyVerified?: boolean; error?: string };
    if (d.error) { setError(d.error); }
    else if (d.alreadyVerified) { setError("This email is already verified."); }
    else {
      setEmails(d.senderEmails ?? emails);
      setPending(d.pending ?? pending);
      setNewEmail("");
      setSuccessMsg(`Verification email sent to ${e}`);
    }
    setAdding(false);
  }

  async function handleRemove(email: string) {
    const res = await fetch("/api/profile/sender-emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", email }),
    });
    const d = await res.json() as { senderEmails?: string[] };
    if (d.senderEmails !== undefined) {
      setEmails(d.senderEmails);
      setPending(prev => prev.filter(p => p.email !== email));
    }
  }

  async function handleResend(email: string) {
    setResending(email);
    setSuccessMsg("");
    const res = await fetch("/api/profile/sender-emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resend", email }),
    });
    const d = await res.json() as { pending?: PendingVerification[]; sent?: boolean };
    if (d.pending) setPending(d.pending);
    if (d.sent) setSuccessMsg(`Verification email resent to ${email}`);
    setResending(null);
  }

  const labelCls = "block text-xs font-semibold text-[#717171] uppercase tracking-wide mb-1";
  const inputCls = "flex-1 border border-[#E8E8E8] rounded-lg px-3 py-2 text-sm text-[#1B3A5C] focus:outline-none focus:border-[#1B3A5C] bg-white";

  return (
    <div style={{ marginTop: "32px", borderTop: "1px solid #F0F0F0", paddingTop: "28px" }}>
      <p className={labelCls} style={{ marginBottom: "4px" }}>Approved sender emails</p>
      <p style={{ fontSize: "13px", color: "#717171", marginBottom: "16px", lineHeight: 1.5 }}>
        Booking confirmation emails forwarded from these addresses will be auto-imported. Each address must be verified before it can be used.
      </p>

      {/* Verified emails */}
      {emails.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
          {emails.map((e) => (
            <div key={e} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "#F0FAF2", borderRadius: "8px", border: "1px solid rgba(74,124,89,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#4a7c59", backgroundColor: "rgba(74,124,89,0.12)", borderRadius: "999px", padding: "1px 7px" }}>Verified ✓</span>
                <span style={{ fontSize: "13px", color: "#1B3A5C" }}>{e}</span>
              </div>
              <button onClick={() => handleRemove(e)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#AAAAAA", lineHeight: 1, padding: "0 4px" }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Pending verifications */}
      {pending.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
          {pending.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "#FFFBF0", borderRadius: "8px", border: "1px solid rgba(245,158,11,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#92650a", backgroundColor: "rgba(245,158,11,0.12)", borderRadius: "999px", padding: "1px 7px", whiteSpace: "nowrap" }}>Awaiting verification</span>
                <span style={{ fontSize: "13px", color: "#555" }}>{p.email}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                <button
                  onClick={() => handleResend(p.email)}
                  disabled={resending === p.email}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#1B3A5C", fontWeight: 600, padding: "2px 4px", opacity: resending === p.email ? 0.5 : 1 }}
                >
                  {resending === p.email ? "Sending…" : "Resend"}
                </button>
                <button onClick={() => handleRemove(p.email)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#AAAAAA", lineHeight: 1, padding: "0 4px" }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <input
          type="email"
          placeholder="you@example.com"
          value={newEmail}
          onChange={(e) => { setNewEmail(e.target.value); setError(""); setSuccessMsg(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          className={inputCls}
        />
        <button
          onClick={handleAdd}
          disabled={adding}
          style={{ padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: "#1B3A5C", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: adding ? "not-allowed" : "pointer", opacity: adding ? 0.7 : 1, whiteSpace: "nowrap" }}
        >
          {adding ? "Sending…" : "Add email"}
        </button>
      </div>
      {error && <p style={{ fontSize: "12px", color: "#C4664A", marginTop: "6px" }}>{error}</p>}
      {successMsg && <p style={{ fontSize: "12px", color: "#4a7c59", marginTop: "6px" }}>{successMsg}</p>}
    </div>
  );
}
