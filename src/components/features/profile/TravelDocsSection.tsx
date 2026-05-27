"use client";

import { useState, useEffect } from "react";
import { COUNTRIES } from "@/lib/countries";

interface Member {
  id: string;
  name: string | null;
  role: "ADULT" | "CHILD";
  birthDate: string | null;
  // travel doc fields (may be null when first loaded)
  passportCountry?: string | null;
  passportNumber?: string | null;
  citizenshipCountry?: string | null;
  passportIssueDate?: string | null;
  passportExpiryDate?: string | null;
  globalEntry?: string | null;
  nexus?: string | null;
  redress?: string | null;
  ktn?: string | null;
  visaNotes?: string | null;
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

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return d; }
}

const inputSt: React.CSSProperties = {
  padding: "6px 10px", border: "1px solid #E8E8E8",
  borderRadius: "6px", fontSize: "14px", color: "#1a1a1a",
  backgroundColor: "#fff", outline: "none",
};

const labelSt: React.CSSProperties = {
  fontSize: "11px", fontWeight: 600, color: "#717171",
  textTransform: "uppercase", letterSpacing: "0.06em",
};

const sectionHeading: React.CSSProperties = {
  fontSize: "11px", fontWeight: 600, color: "#717171",
  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px",
};

// Converts ISO datetime string from DB to yyyy-MM-dd for date inputs
function toDateInput(val: string | null | undefined): string {
  if (!val) return "";
  try { return new Date(val).toISOString().slice(0, 10); }
  catch { return ""; }
}

function InlineField({
  memberId,
  fieldKey,
  label,
  displayValue,
  inputType,
  inputValue,
  openField,
  setOpenField,
  onSaved,
  masked,
}: {
  memberId: string;
  fieldKey: string;
  label: string;
  displayValue: string;
  inputType?: string;
  inputValue: string;
  openField: string | null;
  setOpenField: (f: string | null) => void;
  onSaved: (field: string, value: string) => void;
  masked?: boolean;
}) {
  const [localVal, setLocalVal] = useState(inputValue);
  const [saving, setSaving] = useState(false);
  const isOpen = openField === fieldKey;

  // Sync local val when inputValue changes from parent
  useEffect(() => {
    if (!isOpen) setLocalVal(inputValue);
  }, [inputValue, isOpen]);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/profile/travel-docs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, field: fieldKey, value: localVal }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved(fieldKey, localVal);
      setOpenField(null);
    }
  }

  return (
    <div>
      <p style={labelSt}>{label}</p>
      {isOpen ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
          <input
            type={inputType ?? "text"}
            style={{ ...inputSt, flex: 1 }}
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            autoFocus
          />
          <button
            onClick={save}
            disabled={saving}
            style={{
              backgroundColor: "#1B3A5C", color: "#fff", border: "none",
              borderRadius: "6px", padding: "6px 14px", fontSize: "13px",
              fontWeight: 500, cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1, flexShrink: 0,
            }}
          >
            {saving ? "…" : "Save"}
          </button>
          <button
            onClick={() => { setLocalVal(inputValue); setOpenField(null); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "13px", color: "#717171", padding: 0, flexShrink: 0,
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px" }}>
          <span style={{ fontSize: "14px", color: displayValue ? "#1a1a1a" : "#CCCCCC" }}>
            {displayValue ? (masked ? mask(displayValue) : displayValue) : "—"}
          </span>
          <button
            onClick={() => { setLocalVal(inputValue); setOpenField(fieldKey); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "12px", color: "#C4664A", fontWeight: 500, padding: 0,
            }}
          >
            {displayValue ? "Edit" : "+ Add"}
          </button>
        </div>
      )}
    </div>
  );
}

function InlineSelectField({
  memberId,
  fieldKey,
  label,
  displayValue,
  inputValue,
  openField,
  setOpenField,
  onSaved,
}: {
  memberId: string;
  fieldKey: string;
  label: string;
  displayValue: string;
  inputValue: string;
  openField: string | null;
  setOpenField: (f: string | null) => void;
  onSaved: (field: string, value: string) => void;
}) {
  const [localVal, setLocalVal] = useState(inputValue);
  const [saving, setSaving] = useState(false);
  const isOpen = openField === fieldKey;

  useEffect(() => {
    if (!isOpen) setLocalVal(inputValue);
  }, [inputValue, isOpen]);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/profile/travel-docs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, field: fieldKey, value: localVal }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved(fieldKey, localVal);
      setOpenField(null);
    }
  }

  return (
    <div>
      <p style={labelSt}>{label}</p>
      {isOpen ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
          <select
            style={{ ...inputSt, flex: 1 }}
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            autoFocus
          >
            <option value="">Select country...</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.name}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={save}
            disabled={saving}
            style={{
              backgroundColor: "#1B3A5C", color: "#fff", border: "none",
              borderRadius: "6px", padding: "6px 14px", fontSize: "13px",
              fontWeight: 500, cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1, flexShrink: 0,
            }}
          >
            {saving ? "…" : "Save"}
          </button>
          <button
            onClick={() => { setLocalVal(inputValue); setOpenField(null); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#717171", padding: 0, flexShrink: 0 }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px" }}>
          <span style={{ fontSize: "14px", color: displayValue ? "#1a1a1a" : "#CCCCCC" }}>
            {displayValue || "—"}
          </span>
          <button
            onClick={() => { setLocalVal(inputValue); setOpenField(fieldKey); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#C4664A", fontWeight: 500, padding: 0 }}
          >
            {displayValue ? "Edit" : "+ Add"}
          </button>
        </div>
      )}
    </div>
  );
}

function InlineTextareaField({
  memberId,
  fieldKey,
  label,
  displayValue,
  openField,
  setOpenField,
  onSaved,
}: {
  memberId: string;
  fieldKey: string;
  label: string;
  displayValue: string;
  openField: string | null;
  setOpenField: (f: string | null) => void;
  onSaved: (field: string, value: string) => void;
}) {
  const [localVal, setLocalVal] = useState(displayValue);
  const [saving, setSaving] = useState(false);
  const isOpen = openField === fieldKey;

  useEffect(() => {
    if (!isOpen) setLocalVal(displayValue);
  }, [displayValue, isOpen]);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/profile/travel-docs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, field: fieldKey, value: localVal }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved(fieldKey, localVal);
      setOpenField(null);
    }
  }

  return (
    <div>
      <p style={labelSt}>{label}</p>
      {isOpen ? (
        <div style={{ marginTop: "4px" }}>
          <textarea
            style={{ ...inputSt, width: "100%", resize: "vertical", boxSizing: "border-box" }}
            rows={3}
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            placeholder="e.g. US passport, visa on arrival for Japan."
            autoFocus
          />
          <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                backgroundColor: "#1B3A5C", color: "#fff", border: "none",
                borderRadius: "6px", padding: "6px 14px", fontSize: "13px",
                fontWeight: 500, cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setLocalVal(displayValue); setOpenField(null); }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "13px", color: "#717171", padding: 0,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: "3px" }}>
          {displayValue ? (
            <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5, margin: 0 }}>{displayValue}</p>
          ) : (
            <p style={{ fontSize: "13px", color: "#CCCCCC", margin: 0 }}>
              e.g. US passport, visa on arrival for Japan.
            </p>
          )}
          <button
            onClick={() => { setLocalVal(displayValue); setOpenField(fieldKey); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "12px", color: "#C4664A", fontWeight: 500, padding: "4px 0 0",
            }}
          >
            {displayValue ? "Edit" : "+ Add"}
          </button>
        </div>
      )}
    </div>
  );
}

function DocCard({ member: initialMember }: { member: Member }) {
  const [member, setMember] = useState<Member>(initialMember);
  const [openField, setOpenField] = useState<string | null>(null);

  function handleSaved(field: string, value: string) {
    setMember((m) => ({ ...m, [field]: value }));
  }

  const rolePill = (
    <span style={{
      fontSize: "11px", fontWeight: 700, padding: "2px 10px", borderRadius: "999px",
      backgroundColor: member.role === "ADULT" ? "#1B3A5C" : "#C4664A",
      color: "#fff", textTransform: "uppercase" as const, letterSpacing: "0.05em",
    }}>
      {member.role}
    </span>
  );

  const sharedProps = { memberId: member.id, openField, setOpenField, onSaved: handleSaved };

  const expiryForDisplay = member.passportExpiryDate
    ? fmtDate(member.passportExpiryDate)
    : "—";

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E8E8E8", padding: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <span style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", flex: 1 }}>
          {member.name || "Unnamed traveler"}
        </span>
        {rolePill}
      </div>

      {/* Passport subsection */}
      <div style={{ borderTop: "1px solid #E8E8E8", paddingTop: "16px", marginTop: "4px" }}>
        <p style={sectionHeading}>Passport</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
          <InlineSelectField
            fieldKey="passportCountry"
            label="Issuing country"
            displayValue={member.passportCountry || ""}
            inputValue={member.passportCountry || ""}
            {...sharedProps}
          />
          <InlineField
            fieldKey="passportNumber"
            label="Passport number"
            displayValue={member.passportNumber || ""}
            inputValue={member.passportNumber || ""}
            masked
            {...sharedProps}
          />
          <InlineSelectField
            fieldKey="citizenshipCountry"
            label="Citizenship"
            displayValue={member.citizenshipCountry || ""}
            inputValue={member.citizenshipCountry || ""}
            {...sharedProps}
          />
          <InlineField
            fieldKey="passportIssueDate"
            label="Issue date"
            displayValue={fmtDate(member.passportIssueDate)}
            inputType="date"
            inputValue={toDateInput(member.passportIssueDate)}
            {...sharedProps}
          />
          <div>
            <p style={labelSt}>Expiry date</p>
            {openField === "passportExpiryDate" ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                <ExpiryDateField
                  memberId={member.id}
                  currentValue={toDateInput(member.passportExpiryDate)}
                  onSaved={(val) => { handleSaved("passportExpiryDate", val); setOpenField(null); }}
                  onCancel={() => setOpenField(null)}
                />
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                <span style={{ fontSize: "14px", color: member.passportExpiryDate ? "#1a1a1a" : "#CCCCCC" }}>
                  {expiryForDisplay}
                </span>
                {member.passportExpiryDate && isExpiringSoon(member.passportExpiryDate) && (
                  <span style={{
                    fontSize: "11px", fontWeight: 600, padding: "1px 8px",
                    borderRadius: "999px", backgroundColor: "#FEF3C7", color: "#92400E",
                  }}>
                    Expires soon
                  </span>
                )}
                <button
                  onClick={() => setOpenField("passportExpiryDate")}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#C4664A", fontWeight: 500, padding: 0 }}
                >
                  {member.passportExpiryDate ? "Edit" : "+ Add"}
                </button>
              </div>
            )}
          </div>
          <div>
            <p style={labelSt}>Status</p>
            <p style={{
              fontSize: "13px", fontWeight: 600, margin: "3px 0 0",
              color: member.passportExpiryDate && isExpired(member.passportExpiryDate) ? "#e53e3e" : "#16a34a",
            }}>
              {member.passportExpiryDate ? (isExpired(member.passportExpiryDate) ? "Expired" : "Valid") : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Trusted Traveler subsection */}
      <div style={{ borderTop: "1px solid #E8E8E8", paddingTop: "16px", marginTop: "16px" }}>
        <p style={sectionHeading}>Trusted Traveler Programs</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <InlineField
            fieldKey="ktn"
            label="TSA PreCheck / KTN"
            displayValue={member.ktn || ""}
            inputValue={member.ktn || ""}
            {...sharedProps}
          />
          <InlineField
            fieldKey="globalEntry"
            label="Global Entry"
            displayValue={member.globalEntry || ""}
            inputValue={member.globalEntry || ""}
            {...sharedProps}
          />
          <InlineField
            fieldKey="nexus"
            label="NEXUS number"
            displayValue={member.nexus || ""}
            inputValue={member.nexus || ""}
            {...sharedProps}
          />
          <InlineField
            fieldKey="redress"
            label="Redress number"
            displayValue={member.redress || ""}
            inputValue={member.redress || ""}
            {...sharedProps}
          />
        </div>
      </div>

      {/* Visa Notes subsection */}
      <div style={{ borderTop: "1px solid #E8E8E8", paddingTop: "16px", marginTop: "16px" }}>
        <p style={sectionHeading}>Visa Notes</p>
        <InlineTextareaField
          fieldKey="visaNotes"
          label=""
          displayValue={member.visaNotes || ""}
          {...sharedProps}
        />
      </div>
    </div>
  );
}

// Separate component for expiry date to handle its own local state cleanly
function ExpiryDateField({
  memberId,
  currentValue,
  onSaved,
  onCancel,
}: {
  memberId: string;
  currentValue: string;
  onSaved: (val: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(currentValue);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/profile/travel-docs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, field: "passportExpiryDate", value: val }),
    });
    setSaving(false);
    if (res.ok) onSaved(val);
  }

  return (
    <>
      <input type="date" style={{ ...inputSt, flex: 1 }} value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
      <button
        onClick={save}
        disabled={saving}
        style={{
          backgroundColor: "#1B3A5C", color: "#fff", border: "none",
          borderRadius: "6px", padding: "6px 14px", fontSize: "13px",
          fontWeight: 500, cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1, flexShrink: 0,
        }}
      >
        {saving ? "…" : "Save"}
      </button>
      <button
        onClick={onCancel}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#717171", padding: 0, flexShrink: 0 }}
      >
        Cancel
      </button>
    </>
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
