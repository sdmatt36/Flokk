"use client";

import { useState, useEffect } from "react";

interface Member {
  id: string;
  name: string | null;
  role: "ADULT" | "CHILD";
  birthDate: string | null;
}

interface PassportData {
  passportCountry: string;
  passportNumber: string;
  citizenshipCountry: string;
  issueDate: string;
  expiryDate: string;
  globalEntry: string;
  nexus: string;
  redress: string;
  ktn: string;
}

function emptyPassport(): PassportData {
  return { passportCountry: "", passportNumber: "", citizenshipCountry: "", issueDate: "", expiryDate: "", globalEntry: "", nexus: "", redress: "", ktn: "" };
}

function loadPassport(id: string): PassportData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`flokk_passport_${id}`);
    return raw ? { ...emptyPassport(), ...JSON.parse(raw) } : null;
  } catch { return null; }
}

function savePassport(id: string, data: PassportData) {
  try { localStorage.setItem(`flokk_passport_${id}`, JSON.stringify(data)); } catch { /* ignore */ }
}

function mask(num: string): string {
  if (!num || num.length < 4) return num || "—";
  return `•••• ${num.slice(-4)}`;
}

function expiryWarning(expiryDate: string): boolean {
  if (!expiryDate) return false;
  const exp = new Date(expiryDate);
  const sixMonths = new Date();
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  return exp <= sixMonths;
}

const inputSt: React.CSSProperties = {
  width: "100%", padding: "8px 12px", border: "1px solid #E8E8E8",
  borderRadius: "8px", fontSize: "14px", color: "#1a1a1a",
  backgroundColor: "#fff", outline: "none", boxSizing: "border-box",
};
const labelSt: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 600, color: "#999",
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px",
};

function InfoPair({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p style={{ ...labelSt, margin: 0 }}>{label}</p>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
        <p style={{ fontSize: "14px", color: "#1a1a1a", margin: 0 }}>{value || "—"}</p>
        {warn && value && (
          <span style={{
            fontSize: "11px", fontWeight: 600, padding: "2px 8px",
            borderRadius: "999px", backgroundColor: "#FEF3C7", color: "#92400E",
          }}>
            Expires soon
          </span>
        )}
      </div>
    </div>
  );
}

function DocCard({ member }: { member: Member }) {
  const [editing, setEditing] = useState(false);
  const [passport, setPassport] = useState<PassportData | null>(() => loadPassport(member.id));
  const [form, setForm] = useState<PassportData>(() => loadPassport(member.id) ?? emptyPassport());

  const rolePill = (
    <span style={{
      fontSize: "11px", fontWeight: 700, padding: "2px 10px", borderRadius: "999px",
      backgroundColor: member.role === "ADULT" ? "#1B3A5C" : "#C4664A",
      color: "#fff", textTransform: "uppercase" as const, letterSpacing: "0.05em",
    }}>
      {member.role}
    </span>
  );

  function handleSave() {
    savePassport(member.id, form);
    setPassport(form);
    setEditing(false);
  }

  function f(key: keyof PassportData) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [key]: e.target.value })),
    };
  }

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E8E8E8", padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <span style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", flex: 1 }}>
          {member.name || "Unnamed traveler"}
        </span>
        {rolePill}
        <button
          onClick={() => setEditing(true)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 500, color: "#C4664A", padding: 0 }}
        >
          Edit
        </button>
      </div>

      {!editing ? (
        passport ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <InfoPair label="Passport country" value={passport.passportCountry} />
              <InfoPair label="Passport number" value={mask(passport.passportNumber)} />
              <InfoPair label="Issue date" value={passport.issueDate} />
              <InfoPair label="Expiry date" value={passport.expiryDate} warn={expiryWarning(passport.expiryDate)} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <InfoPair label="Global Entry" value={passport.globalEntry} />
              <InfoPair label="TSA PreCheck KTN" value={passport.ktn} />
              <InfoPair label="NEXUS" value={passport.nexus} />
              <InfoPair label="Redress number" value={passport.redress} />
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#C4664A", fontWeight: 500, padding: 0 }}
          >
            + Add passport details
          </button>
        )
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={labelSt}>Passport issuing country</label>
              <input style={inputSt} {...f("passportCountry")} />
            </div>
            <div>
              <label style={labelSt}>Passport number</label>
              <input style={inputSt} {...f("passportNumber")} />
            </div>
            <div>
              <label style={labelSt}>Citizenship country</label>
              <input style={inputSt} {...f("citizenshipCountry")} />
            </div>
            <div>
              <label style={labelSt}>Issue date</label>
              <input type="date" style={inputSt} {...f("issueDate")} />
            </div>
            <div>
              <label style={labelSt}>Expiry date</label>
              <input type="date" style={inputSt} {...f("expiryDate")} />
            </div>
            <div>
              <label style={labelSt}>Global Entry number</label>
              <input style={inputSt} {...f("globalEntry")} />
            </div>
            <div>
              <label style={labelSt}>NEXUS number</label>
              <input style={inputSt} {...f("nexus")} />
            </div>
            <div>
              <label style={labelSt}>Redress number</label>
              <input style={inputSt} {...f("redress")} />
            </div>
            <div>
              <label style={labelSt}>TSA PreCheck KTN</label>
              <input style={inputSt} {...f("ktn")} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleSave}
              style={{ backgroundColor: "#1B3A5C", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 18px", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
            >
              Save
            </button>
            <button
              onClick={() => { setForm(passport ?? emptyPassport()); setEditing(false); }}
              style={{ backgroundColor: "#fff", color: "#717171", border: "1px solid #E8E8E8", borderRadius: "8px", padding: "8px 18px", fontSize: "13px", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TravelDocsSection() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/family/members")
      .then((r) => r.json())
      .then(({ members: m }) => { if (m) setMembers(m); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "#717171", fontSize: "14px" }}>Loading...</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {members.map((m) => (
        <DocCard key={m.id} member={m} />
      ))}
      {members.length === 0 && (
        <p style={{ color: "#717171", fontSize: "14px" }}>No travelers found. Add travelers in the Travelers section first.</p>
      )}
    </div>
  );
}
