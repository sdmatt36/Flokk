"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Baby, CheckCircle } from "lucide-react";

type MemberData = {
  id: string;
  name: string | null;
  role: "ADULT" | "CHILD";
  birthDate: string | null; // ISO date string YYYY-MM-DD or null
};

function toInputDate(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function EditFamilyClient({
  familyName,
  initialMembers,
}: {
  familyName: string | null;
  initialMembers: MemberData[];
}) {
  const router = useRouter();
  const [members, setMembers] = useState<MemberData[]>(initialMembers);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const updateMember = (id: string, field: keyof MemberData, value: string | null) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
    setSaved(false);
  };

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/family/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          members: members.map((m) => ({
            id: m.id,
            name: m.name ?? "",
            birthDate: m.birthDate || null,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Save failed");
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const adults = members.filter((m) => m.role === "ADULT");
  const children = members.filter((m) => m.role === "CHILD");
  const ordered = [...adults, ...children];

  return (
    <div style={{ maxWidth: "520px", margin: "0 auto", padding: "32px 24px 96px" }}>

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#1a1a1a", lineHeight: 1.2 }}>
          {familyName ? `${familyName} family` : "Your family"}
        </h1>
        <p style={{ fontSize: "14px", color: "#717171", marginTop: "6px" }}>
          Update names and birth dates for each member.
        </p>
      </div>

      {/* Member cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {ordered.map((member) => {
          const isAdult = member.role === "ADULT";
          const avatarBg = isAdult ? "#C4664A" : "#1B3A5C";
          const initial = member.name?.trim()
            ? member.name.trim()[0].toUpperCase()
            : isAdult ? "A" : "C";

          return (
            <div
              key={member.id}
              style={{
                backgroundColor: "#fff",
                border: "1.5px solid #EEEEEE",
                borderLeft: `4px solid ${avatarBg}`,
                borderRadius: "16px",
                padding: "20px",
              }}
            >
              {/* Card header */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{initial}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {isAdult
                    ? <User size={13} style={{ color: "#C4664A" }} />
                    : <Baby size={13} style={{ color: "#1B3A5C" }} />}
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#717171" }}>
                    {isAdult ? "Adult" : "Child"}
                  </span>
                </div>
              </div>

              {/* First name */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#717171", marginBottom: "6px" }}>
                  First name
                </label>
                <input
                  type="text"
                  value={member.name ?? ""}
                  onChange={(e) => updateMember(member.id, "name", e.target.value)}
                  placeholder={isAdult ? "e.g. Matt" : "e.g. Beau"}
                  style={{
                    width: "100%",
                    height: "42px",
                    padding: "0 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #EEEEEE",
                    fontSize: "15px",
                    color: "#1a1a1a",
                    backgroundColor: "#fff",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Birth date — shown for all, required context for children */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#717171", marginBottom: "6px" }}>
                  {isAdult ? "Date of birth (optional)" : "Date of birth"}
                </label>
                <input
                  type="date"
                  value={toInputDate(member.birthDate)}
                  onChange={(e) => updateMember(member.id, "birthDate", e.target.value || null)}
                  style={{
                    width: "100%",
                    height: "42px",
                    padding: "0 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #EEEEEE",
                    fontSize: "14px",
                    color: "#1a1a1a",
                    backgroundColor: "#fff",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {!isAdult && (
                  <p style={{ fontSize: "11px", color: "#AAAAAA", marginTop: "4px" }}>
                    Used to calculate age and tailor recommendations.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <p style={{ fontSize: "13px", color: "#C4664A", marginTop: "16px" }}>{error}</p>
      )}

      {/* Save all */}
      <div style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {saved && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "center" }}>
            <CheckCircle size={16} style={{ color: "#6B8F71" }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#6B8F71" }}>Saved</span>
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%",
            height: "52px",
            borderRadius: "999px",
            backgroundColor: saving ? "#EEEEEE" : "#C4664A",
            color: saving ? "#AAAAAA" : "#fff",
            fontWeight: 700,
            fontSize: "15px",
            border: "none",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save all"}
        </button>
        <button
          onClick={() => router.push("/home")}
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
          Back to home
        </button>
      </div>
    </div>
  );
}
