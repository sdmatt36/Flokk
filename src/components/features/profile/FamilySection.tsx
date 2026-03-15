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

      <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E8E8E8", padding: "24px" }}>
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
    </div>
  );
}
