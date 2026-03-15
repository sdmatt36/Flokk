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
  visaNotes: string;
}

function emptyPassport(): PassportData {
  return {
    passportCountry: "", passportNumber: "", citizenshipCountry: "",
    issueDate: "", expiryDate: "", globalEntry: "", nexus: "", redress: "", ktn: "", visaNotes: "",
  };
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
  if (!num) return "—";
  if (num.length <= 4) return num;
  return `•••• ${num.slice(-4)}`;
}

function isExpiringSoon(expiryDate: string): boolean {
  if (!expiryDate) return false;
  const exp = new Date(expiryDate);
  const sixMonths = new Date();
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  return exp <= sixMonths;
}

function isExpired(expiryDate: string): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
}

function fmtDate(d: string): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return d; }
}

const inputSt: React.CSSProperties = {
  width: "100%", padding: "8px 12px", border: "1px solid #E8E8E8",
  borderRadius: "8px", fontSize: "14px", color: "#1a1a1a",
  backgroundColor: "#fff", outline: "none", boxSizing: "border-box",
};

const labelSt: React.CSSProperties = {
  fontSize: "11px", fontWeight: 600, color: "#717171",
  textTransform: "uppercase", letterSpacing: "0.06em",
};

const sectionHeading: React.CSSProperties = {
  fontSize: "11px", fontWeight: 600, color: "#717171",
  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px",
};

function ValueOrAdd({ value, onAdd }: { value: string; onAdd: () => void }) {
  if (value) return <span style={{ fontSize: "14px", color: "#1B3A5C" }}>{value}</span>;
  return (
    <button onClick={onAdd} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#C4664A", fontWeight: 500, padding: 0 }}>
      — Add
    </button>
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
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((p) => ({ ...p, [key]: e.target.value })),
    };
  }

  const hasPassport = passport && (passport.passportNumber || passport.passportCountry);
  const hasPrograms = passport && (passport.ktn || passport.globalEntry || passport.nexus || passport.redress);

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E8E8E8", padding: "24px" }}>
      {/* Header */}
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
        <>
          {/* Passport subsection */}
          <div style={{ borderTop: "1px solid #E8E8E8", paddingTop: "16px", marginTop: "4px" }}>
            <p style={sectionHeading}>Passport</p>
            {hasPassport ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                <div>
                  <p style={labelSt}>Issuing country</p>
                  <p style={{ fontSize: "14px", color: "#1a1a1a", margin: "3px 0 0" }}>{passport!.passportCountry || "—"}</p>
                </div>
                <div>
                  <p style={labelSt}>Passport number</p>
                  <p style={{ fontSize: "14px", color: "#1a1a1a", margin: "3px 0 0" }}>{mask(passport!.passportNumber)}</p>
                </div>
                <div>
                  <p style={labelSt}>Citizenship</p>
                  <p style={{ fontSize: "14px", color: "#1a1a1a", margin: "3px 0 0" }}>{passport!.citizenshipCountry || "—"}</p>
                </div>
                <div>
                  <p style={labelSt}>Issue date</p>
                  <p style={{ fontSize: "14px", color: "#1a1a1a", margin: "3px 0 0" }}>{fmtDate(passport!.issueDate)}</p>
                </div>
                <div>
                  <p style={labelSt}>Expiry date</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                    <p style={{ fontSize: "14px", color: "#1a1a1a", margin: 0 }}>{fmtDate(passport!.expiryDate)}</p>
                    {passport!.expiryDate && isExpiringSoon(passport!.expiryDate) && (
                      <span style={{
                        fontSize: "11px", fontWeight: 600, padding: "1px 8px",
                        borderRadius: "999px", backgroundColor: "#FEF3C7", color: "#92400E",
                      }}>
                        Expires soon
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p style={labelSt}>Status</p>
                  <p style={{
                    fontSize: "13px", fontWeight: 600, margin: "3px 0 0",
                    color: passport!.expiryDate && isExpired(passport!.expiryDate) ? "#e53e3e" : "#16a34a",
                  }}>
                    {passport!.expiryDate ? (isExpired(passport!.expiryDate) ? "Expired" : "Valid") : "—"}
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#C4664A", fontWeight: 500, padding: 0 }}
              >
                + Add passport details
              </button>
            )}
          </div>

          {/* Trusted Traveler subsection */}
          <div style={{ borderTop: "1px solid #E8E8E8", paddingTop: "16px", marginTop: "16px" }}>
            <p style={sectionHeading}>Trusted Traveler Programs</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <p style={labelSt}>TSA PreCheck / KTN</p>
                <div style={{ marginTop: "3px" }}>
                  <ValueOrAdd value={passport?.ktn || ""} onAdd={() => setEditing(true)} />
                </div>
              </div>
              <div>
                <p style={labelSt}>Global Entry</p>
                <div style={{ marginTop: "3px" }}>
                  <ValueOrAdd value={passport?.globalEntry || ""} onAdd={() => setEditing(true)} />
                </div>
              </div>
              <div>
                <p style={labelSt}>NEXUS number</p>
                <div style={{ marginTop: "3px" }}>
                  <ValueOrAdd value={passport?.nexus || ""} onAdd={() => setEditing(true)} />
                </div>
              </div>
              <div>
                <p style={labelSt}>Redress number</p>
                <div style={{ marginTop: "3px" }}>
                  <ValueOrAdd value={passport?.redress || ""} onAdd={() => setEditing(true)} />
                </div>
              </div>
            </div>
          </div>

          {/* Visa Notes subsection */}
          <div style={{ borderTop: "1px solid #E8E8E8", paddingTop: "16px", marginTop: "16px" }}>
            <p style={sectionHeading}>Visa Notes</p>
            {passport?.visaNotes ? (
              <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5, margin: 0 }}>{passport.visaNotes}</p>
            ) : (
              <p style={{ fontSize: "13px", color: "#CCCCCC", margin: 0 }}>
                e.g. US passport — visa on arrival for Japan. Indian passport — requires visa for Schengen.
              </p>
            )}
          </div>
        </>
      ) : (
        // Edit mode
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <p style={{ fontSize: "12px", color: "#717171", margin: 0 }}>
            Name is managed in the Travelers section.
          </p>

          <div>
            <p style={{ ...sectionHeading, marginBottom: "10px" }}>Passport</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={{ display: "block", ...labelSt, marginBottom: "4px" }}>Passport issuing country</label>
                <input style={inputSt} {...f("passportCountry")} />
              </div>
              <div>
                <label style={{ display: "block", ...labelSt, marginBottom: "4px" }}>Passport number</label>
                <input style={inputSt} {...f("passportNumber")} />
              </div>
              <div>
                <label style={{ display: "block", ...labelSt, marginBottom: "4px" }}>Citizenship country</label>
                <input style={inputSt} {...f("citizenshipCountry")} />
              </div>
              <div>
                <label style={{ display: "block", ...labelSt, marginBottom: "4px" }}>Issue date</label>
                <input type="date" style={inputSt} {...f("issueDate")} />
              </div>
              <div>
                <label style={{ display: "block", ...labelSt, marginBottom: "4px" }}>Expiry date</label>
                <input type="date" style={inputSt} {...f("expiryDate")} />
              </div>
            </div>
          </div>

          <div>
            <p style={{ ...sectionHeading, marginBottom: "10px" }}>Trusted Traveler Programs</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={{ display: "block", ...labelSt, marginBottom: "4px" }}>TSA PreCheck / KTN</label>
                <input style={inputSt} {...f("ktn")} />
              </div>
              <div>
                <label style={{ display: "block", ...labelSt, marginBottom: "4px" }}>Global Entry number</label>
                <input style={inputSt} {...f("globalEntry")} />
              </div>
              <div>
                <label style={{ display: "block", ...labelSt, marginBottom: "4px" }}>NEXUS number</label>
                <input style={inputSt} {...f("nexus")} />
              </div>
              <div>
                <label style={{ display: "block", ...labelSt, marginBottom: "4px" }}>Redress number</label>
                <input style={inputSt} {...f("redress")} />
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: "block", ...labelSt, marginBottom: "4px" }}>Visa notes</label>
            <textarea
              style={{ ...inputSt, resize: "vertical" }}
              rows={3}
              placeholder="e.g. US passport — visa on arrival for Japan. Indian passport — requires visa for Schengen."
              {...f("visaNotes")}
            />
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
      {members.map((m) => <DocCard key={m.id} member={m} />)}
      {members.length === 0 && (
        <p style={{ color: "#717171", fontSize: "14px" }}>No travelers found. Add travelers in the Travelers section first.</p>
      )}
    </div>
  );
}
