"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";

const DIETARY_OPTIONS = [
  { value: "HALAL", label: "Halal" },
  { value: "KOSHER", label: "Kosher" },
  { value: "VEGETARIAN", label: "Vegetarian" },
  { value: "PESCATARIAN", label: "Pescatarian" },
  { value: "VEGAN", label: "Vegan" },
  { value: "GLUTEN_FREE", label: "Gluten-free" },
  { value: "NUT_FREE", label: "Nut-free" },
  { value: "DAIRY_FREE", label: "Dairy-free" },
];

const FOOD_ALLERGIES = [
  { value: "gluten",    label: "Gluten / Coeliac" },
  { value: "peanuts",   label: "Peanuts" },
  { value: "tree_nuts", label: "Tree nuts" },
  { value: "dairy",     label: "Dairy / Lactose" },
  { value: "eggs",      label: "Eggs" },
  { value: "shellfish", label: "Shellfish" },
  { value: "fish",      label: "Fish" },
  { value: "soy",       label: "Soy" },
  { value: "sesame",    label: "Sesame" },
  { value: "sulphites", label: "Sulphites" },
];

const SEAT_OPTIONS = ["Window", "Middle", "Aisle", "No preference"];
const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"];

interface Member {
  id: string;
  name: string | null;
  role: "ADULT" | "CHILD";
  birthDate: string | null;
  dietaryRequirements: string[];
  mobilityNotes: string | null;
  foodAllergies: string[];
  allergyNotes: string | null;
}

interface MemberExt {
  gender: string;
  seatPreference: string;
  ktn: string;
  redressNumber: string;
  specialMealType: string;
  specialAssistance: string;
}

function emptyExt(): MemberExt {
  return { gender: "", seatPreference: "", ktn: "", redressNumber: "", specialMealType: "", specialAssistance: "" };
}

function loadExt(id: string): MemberExt {
  if (typeof window === "undefined") return emptyExt();
  try {
    const raw = localStorage.getItem(`flokk_member_ext_${id}`);
    return raw ? { ...emptyExt(), ...JSON.parse(raw) } : emptyExt();
  } catch { return emptyExt(); }
}

function saveExt(id: string, data: MemberExt) {
  try { localStorage.setItem(`flokk_member_ext_${id}`, JSON.stringify(data)); } catch { /* ignore */ }
}

function parseName(fullName: string | null): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: "", lastName: "" };
  const idx = fullName.indexOf(" ");
  if (idx === -1) return { firstName: fullName, lastName: "" };
  return { firstName: fullName.slice(0, idx), lastName: fullName.slice(idx + 1) };
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return "—";
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return `${age} yrs`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", border: "1px solid #E8E8E8",
  borderRadius: "8px", fontSize: "14px", color: "#1a1a1a",
  backgroundColor: "#fff", outline: "none", boxSizing: "border-box",
};

const labelSt: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 600,
  color: "#717171", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em",
};

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: "11px", fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{label}</p>
      <p style={{ fontSize: "14px", color: "#1a1a1a", margin: "2px 0 0" }}>{value || "—"}</p>
    </div>
  );
}

function TravelerCard({
  member,
  onUpdated,
  onDeleted,
  initEdit,
}: {
  member: Member;
  onUpdated: (m: Member) => void;
  onDeleted: (id: string) => void;
  initEdit?: boolean;
}) {
  const [editing, setEditing] = useState(initEdit ?? false);
  const [saving, setSaving] = useState(false);
  const [savingAllergies, setSavingAllergies] = useState(false);
  const [ext, setExt] = useState<MemberExt>(() => loadExt(member.id));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  const parsed = parseName(member.name);
  const [form, setForm] = useState({
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    birthDate: member.birthDate ? member.birthDate.slice(0, 10) : "",
    dietaryRequirements: [...member.dietaryRequirements],
    mobilityNotes: member.mobilityNotes || "",
  });

  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(member.foodAllergies ?? []);
  const [allergyNotes, setAllergyNotes] = useState(member.allergyNotes ?? "");

  function toggleDiet(val: string) {
    setForm((f) => ({
      ...f,
      dietaryRequirements: f.dietaryRequirements.includes(val)
        ? f.dietaryRequirements.filter((d) => d !== val)
        : [...f.dietaryRequirements, val],
    }));
  }

  function toggleAllergy(val: string) {
    setSelectedAllergies((prev) =>
      prev.includes(val) ? prev.filter((a) => a !== val) : [...prev, val]
    );
  }

  async function handleSaveAllergies() {
    setSavingAllergies(true);
    try {
      await fetch("/api/profile/travel-docs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id, field: "foodAllergies", value: selectedAllergies }),
      });
      await fetch("/api/profile/travel-docs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id, field: "allergyNotes", value: allergyNotes }),
      });
    } catch (err) {
      console.error("Allergy save error:", err);
    } finally {
      setSavingAllergies(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/family/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        birthDate: form.birthDate || null,
        dietaryRequirements: form.dietaryRequirements,
        mobilityNotes: form.mobilityNotes,
      }),
    });
    const data = await res.json();
    saveExt(member.id, ext);
    setSaving(false);
    setEditing(false);
    if (data.member) onUpdated({ ...member, ...data.member, birthDate: data.member.birthDate });
  }

  function handleCancel() {
    const p = parseName(member.name);
    setForm({
      firstName: p.firstName,
      lastName: p.lastName,
      birthDate: member.birthDate ? member.birthDate.slice(0, 10) : "",
      dietaryRequirements: [...member.dietaryRequirements],
      mobilityNotes: member.mobilityNotes || "",
    });
    setExt(loadExt(member.id));
    setSelectedAllergies(member.foodAllergies ?? []);
    setAllergyNotes(member.allergyNotes ?? "");
    setEditing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/family/members/${member.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setConfirmDelete(false);
      setDeleteToast("Member removed");
      setTimeout(() => setDeleteToast(null), 3000);
      onDeleted(member.id);
    } catch {
      setConfirmDelete(false);
      setDeleteToast("Couldn't remove, try again");
      setTimeout(() => setDeleteToast(null), 3000);
    } finally {
      setDeleting(false);
    }
  }

  const rolePill = (
    <span style={{
      fontSize: "11px", fontWeight: 700, padding: "2px 10px", borderRadius: "999px",
      backgroundColor: member.role === "ADULT" ? "#1B3A5C" : "#C4664A",
      color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {member.role}
    </span>
  );

  const displayName = member.name || "Unnamed traveler";

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E8E8E8", padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <span style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", flex: 1 }}>
          {displayName}
        </span>
        {rolePill}
        <button
          onClick={() => setEditing(true)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 500, color: "#C4664A", padding: 0, flexShrink: 0 }}
        >
          Edit
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          title="Remove member"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "44px", height: "44px", borderRadius: "50%", border: "none", background: "none", cursor: "pointer", color: "#CCCCCC", flexShrink: 0, marginRight: "-8px" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#C4664A"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#CCCCCC"; }}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {!editing ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoPair label="Date of birth" value={fmtDate(member.birthDate)} />
          <InfoPair label="Age" value={calcAge(member.birthDate)} />
          <InfoPair label="Dietary requirements" value={member.dietaryRequirements.map((d) => d.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())).join(", ") || "None"} />
          <InfoPair label="Seat preference" value={loadExt(member.id).seatPreference || "—"} />
          <InfoPair label="KTN / TSA PreCheck" value={loadExt(member.id).ktn || "—"} />
          <InfoPair label="Airline meal code" value={loadExt(member.id).specialMealType || "—"} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ fontSize: "12px", color: "#717171", margin: 0 }}>
            Legal name must match passport exactly.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={labelSt}>Legal first name</label>
              <input
                style={inputStyle}
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="First name"
              />
            </div>
            <div>
              <label style={labelSt}>Legal last name</label>
              <input
                style={inputStyle}
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Last name"
              />
            </div>
            <div>
              <label style={labelSt}>Date of birth</label>
              <input
                type="date"
                style={inputStyle}
                value={form.birthDate}
                onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelSt}>Gender</label>
              <select
                style={inputStyle}
                value={ext.gender}
                onChange={(e) => setExt((x) => ({ ...x, gender: e.target.value }))}
              >
                <option value="">Select...</option>
                {GENDER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>Seat preference</label>
              <select
                style={inputStyle}
                value={ext.seatPreference}
                onChange={(e) => setExt((x) => ({ ...x, seatPreference: e.target.value }))}
              >
                <option value="">Select...</option>
                {SEAT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>KTN / TSA PreCheck</label>
              <input
                style={inputStyle}
                value={ext.ktn}
                onChange={(e) => setExt((x) => ({ ...x, ktn: e.target.value }))}
                placeholder="Known traveler number"
              />
            </div>
            <div>
              <label style={labelSt}>Redress number</label>
              <input
                style={inputStyle}
                value={ext.redressNumber}
                onChange={(e) => setExt((x) => ({ ...x, redressNumber: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelSt}>Airline meal code</label>
              <select
                style={{ ...inputStyle, cursor: "pointer" }}
                value={ext.specialMealType}
                onChange={(e) => setExt((x) => ({ ...x, specialMealType: e.target.value }))}
              >
                <option value="">None / Standard</option>
                <option value="VGML">VGML — Vegetarian (non-dairy)</option>
                <option value="AVML">AVML — Asian Vegetarian</option>
                <option value="VVML">VVML — Vegan</option>
                <option value="VLML">VLML — Vegetarian Lacto-Ovo</option>
                <option value="HNML">HNML — Hindu (non-veg)</option>
                <option value="MOML">MOML — Muslim / Halal</option>
                <option value="KSML">KSML — Kosher</option>
                <option value="GFML">GFML — Gluten-free</option>
                <option value="DBML">DBML — Diabetic</option>
                <option value="LSML">LSML — Low sodium</option>
                <option value="LFML">LFML — Low fat</option>
                <option value="NLML">NLML — Nut-free</option>
                <option value="SFML">SFML — Seafood</option>
                <option value="BLML">BLML — Bland</option>
                <option value="CHML">CHML — Child meal</option>
                <option value="BBML">BBML — Baby / Infant meal</option>
              </select>
              <p style={{ fontSize: "11px", color: "#717171", marginTop: "4px" }}>IATA meal codes used by most airlines. Check your airline&apos;s policy for availability.</p>
            </div>
            <div>
              <label style={labelSt}>Special assistance needs</label>
              <input
                style={inputStyle}
                value={ext.specialAssistance}
                onChange={(e) => setExt((x) => ({ ...x, specialAssistance: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label style={labelSt}>Dietary requirements</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
              {DIETARY_OPTIONS.map((opt) => {
                const active = form.dietaryRequirements.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleDiet(opt.value)}
                    style={{
                      padding: "5px 12px", borderRadius: "999px", fontSize: "13px",
                      border: `1px solid ${active ? "#1B3A5C" : "#E8E8E8"}`,
                      backgroundColor: active ? "#1B3A5C" : "#fff",
                      color: active ? "#fff" : "#717171",
                      cursor: "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Food allergies */}
          <div>
            <label style={labelSt}>Food allergies</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px", marginBottom: "10px" }}>
              {FOOD_ALLERGIES.map((opt) => {
                const active = selectedAllergies.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleAllergy(opt.value)}
                    style={{
                      padding: "5px 12px", borderRadius: "999px", fontSize: "13px",
                      border: `1px solid ${active ? "#C4664A" : "#E8E8E8"}`,
                      backgroundColor: active ? "#C4664A" : "#fff",
                      color: active ? "#fff" : "#717171",
                      cursor: "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <textarea
              value={allergyNotes}
              onChange={(e) => setAllergyNotes(e.target.value)}
              placeholder="Other allergies or notes (e.g. severe peanut allergy, carries EpiPen)"
              rows={2}
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily: "inherit",
                marginBottom: "8px",
              }}
            />
            <button
              onClick={handleSaveAllergies}
              disabled={savingAllergies}
              style={{
                backgroundColor: "#fff", color: "#1B3A5C",
                border: "1px solid #1B3A5C", borderRadius: "8px",
                padding: "7px 16px", fontSize: "13px",
                fontWeight: 500, cursor: savingAllergies ? "not-allowed" : "pointer",
                opacity: savingAllergies ? 0.7 : 1,
              }}
            >
              {savingAllergies ? "Saving..." : "Save allergies"}
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                backgroundColor: "#1B3A5C", color: "#fff", border: "none",
                borderRadius: "8px", padding: "8px 18px", fontSize: "13px",
                fontWeight: 500, cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleCancel}
              style={{
                backgroundColor: "#fff", color: "#717171",
                border: "1px solid #E8E8E8", borderRadius: "8px",
                padding: "8px 18px", fontSize: "13px", cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          onClick={() => { if (!deleting) setConfirmDelete(false); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "24px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "28px 24px 24px", maxWidth: "360px", width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
          >
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1B3A5C", marginBottom: "10px" }}>
              Remove {form.firstName || member.name || "this traveler"} from your family?
            </h2>
            <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5, marginBottom: "20px" }}>
              This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                style={{ flex: 1, height: "48px", borderRadius: "999px", border: "1.5px solid #EEEEEE", background: "#fff", fontSize: "15px", fontWeight: 600, color: "#717171", cursor: deleting ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ flex: 1, height: "48px", borderRadius: "999px", border: "none", backgroundColor: deleting ? "#EEEEEE" : "#C4664A", color: deleting ? "#AAAAAA" : "#fff", fontSize: "15px", fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer" }}
              >
                {deleting ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {deleteToast && (
        <div style={{ position: "fixed", bottom: "32px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#1B3A5C", color: "#fff", fontSize: "13px", fontWeight: 600, padding: "10px 20px", borderRadius: "999px", zIndex: 9999, pointerEvents: "none", whiteSpace: "nowrap" }}>
          {deleteToast}
        </div>
      )}
    </div>
  );
}

export function TravelersSection() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/family/members")
      .then((r) => r.json())
      .then(({ members: m }) => { if (m) setMembers(m); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function addMember(role: "ADULT" | "CHILD") {
    const res = await fetch("/api/family/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, name: "", birthDate: null, dietaryRequirements: [], foodAllergies: [], allergyNotes: null }),
    });
    const data = await res.json();
    if (data.member) setMembers((m) => [...m, { foodAllergies: [], allergyNotes: null, ...data.member }]);
  }

  if (loading) return <p style={{ color: "#717171", fontSize: "14px" }}>Loading...</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {members.map((m) => (
        <TravelerCard
          key={m.id}
          member={m}
          onUpdated={(updated) => setMembers((ms) => ms.map((x) => (x.id === updated.id ? updated : x)))}
          onDeleted={(id) => setMembers((ms) => ms.filter((x) => x.id !== id))}
        />
      ))}
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={() => addMember("ADULT")}
          style={{
            border: "1px solid #1B3A5C", color: "#1B3A5C", backgroundColor: "#fff",
            borderRadius: "8px", padding: "9px 18px", fontSize: "13px",
            fontWeight: 500, cursor: "pointer",
          }}
        >
          + Add adult
        </button>
        <button
          onClick={() => addMember("CHILD")}
          style={{
            border: "1px solid #C4664A", color: "#C4664A", backgroundColor: "#fff",
            borderRadius: "8px", padding: "9px 18px", fontSize: "13px",
            fontWeight: 500, cursor: "pointer",
          }}
        >
          + Add child
        </button>
      </div>
    </div>
  );
}
