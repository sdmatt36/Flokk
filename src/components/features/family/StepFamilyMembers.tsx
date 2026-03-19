"use client";

import { useState } from "react";
import { User, Baby } from "lucide-react";
import type { OnboardingData, FamilyMemberInput } from "@/app/(app)/onboarding/page";

const DIETARY_OPTIONS = [
  { value: "VEGETARIAN", label: "Vegetarian" },
  { value: "PESCATARIAN", label: "Pescatarian" },
  { value: "VEGAN", label: "Vegan" },
  { value: "HALAL", label: "Halal" },
  { value: "KOSHER", label: "Kosher" },
  { value: "GLUTEN_FREE", label: "Gluten Free" },
  { value: "NUT_FREE", label: "Nut Free" },
  { value: "DAIRY_FREE", label: "Dairy Free" },
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

interface Props {
  data: OnboardingData;
  onNext: (update: Partial<OnboardingData>) => void;
}

function MemberCard({ member, index, onChange, onRemove }: {
  member: FamilyMemberInput;
  index: number;
  onChange: (m: FamilyMemberInput) => void;
  onRemove: () => void;
}) {
  const toggleDietary = (val: string) => {
    const current = member.dietaryRequirements;
    onChange({
      ...member,
      dietaryRequirements: current.includes(val)
        ? current.filter((d) => d !== val)
        : [...current, val],
    });
  };

  const toggleAllergy = (val: string) => {
    const current = member.foodAllergies;
    onChange({
      ...member,
      foodAllergies: current.includes(val)
        ? current.filter((a) => a !== val)
        : [...current, val],
    });
  };

  return (
    <div className="rounded-2xl p-5 space-y-4 border" style={{ backgroundColor: "#fff", borderColor: "#EEEEEE", borderLeft: "4px solid #C4664A" }}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-semibold text-sm" style={{ color: "#2d2d2d" }}>
          {member.role === "ADULT"
            ? <User size={15} style={{ color: "#C4664A" }} />
            : <Baby size={15} style={{ color: "#6B8F71" }} />}
          {member.role === "ADULT" ? "Adult" : "Child"}
          <span className="font-normal" style={{ color: "#717171" }}>#{index + 1}</span>
        </span>
        <button onClick={onRemove} className="text-xs font-medium transition-colors" style={{ color: "#ccc" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#C4664A")}
          onMouseLeave={e => (e.currentTarget.style.color = "#ccc")}>
          Remove
        </button>
      </div>

      {/* First name */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold" style={{ color: "#717171" }}>First name</label>
        <input
          type="text"
          placeholder={member.role === "ADULT" ? "e.g. Matt" : "e.g. Beau"}
          value={member.name ?? ""}
          onChange={(e) => onChange({ ...member, name: e.target.value })}
          style={{ width: "100%", height: "40px", padding: "0 12px", borderRadius: "10px", border: "1.5px solid #EEEEEE", backgroundColor: "#FFFFFF", fontSize: "14px", color: "#2d2d2d", outline: "none", boxSizing: "border-box" }}
        />
      </div>

      {member.role === "CHILD" && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold" style={{ color: "#717171" }}>Date of birth</label>
          <input
            type="date"
            value={member.birthDate ?? ""}
            onChange={(e) => onChange({ ...member, birthDate: e.target.value })}
            style={{ width: "100%", height: "40px", padding: "0 12px", borderRadius: "10px", border: "1.5px solid #EEEEEE", backgroundColor: "#FFFFFF", fontSize: "14px", color: "#2d2d2d", outline: "none" }}
          />
          <p className="text-xs" style={{ color: "#717171" }}>We use birth date so recommendations stay accurate as your kids grow.</p>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-semibold" style={{ color: "#717171" }}>
          Dietary needs <span className="font-normal" style={{ color: "#717171" }}>(optional)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map((opt) => {
            const active = member.dietaryRequirements.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleDietary(opt.value)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                style={{
                  borderColor: active ? "#C4664A" : "#EEEEEE",
                  backgroundColor: active ? "#C4664A" : "#fff",
                  color: active ? "#fff" : "#717171",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold" style={{ color: "#717171" }}>
          Food allergies <span className="font-normal" style={{ color: "#717171" }}>(optional)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {FOOD_ALLERGIES.map((opt) => {
            const active = member.foodAllergies.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleAllergy(opt.value)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                style={{
                  borderColor: active ? "#1B3A5C" : "#EEEEEE",
                  backgroundColor: active ? "#1B3A5C" : "#fff",
                  color: active ? "#fff" : "#717171",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <textarea
          value={member.allergyNotes ?? ""}
          onChange={(e) => onChange({ ...member, allergyNotes: e.target.value })}
          placeholder="Other allergies or notes (e.g. severe peanut allergy, carries EpiPen)"
          rows={2}
          style={{
            width: "100%", padding: "8px 12px", borderRadius: "10px",
            border: "1.5px solid #EEEEEE", backgroundColor: "#FFFFFF",
            fontSize: "13px", color: "#2d2d2d", outline: "none",
            resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}

export function StepFamilyMembers({ data, onNext }: Props) {
  const [members, setMembers] = useState<FamilyMemberInput[]>(
    data.members.length > 0 ? data.members : [{ role: "ADULT", dietaryRequirements: [], foodAllergies: [] }]
  );

  const addMember = (role: "ADULT" | "CHILD") => {
    setMembers((prev) => [...prev, { role, dietaryRequirements: [], foodAllergies: [] }]);
  };

  const updateMember = (index: number, m: FamilyMemberInput) => {
    setMembers((prev) => prev.map((item, i) => (i === index ? m : item)));
  };

  const removeMember = (index: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-8 pt-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-black" style={{ color: "#1a1a1a" }}>Your crew.</h1>
        <p className="text-lg" style={{ color: "#717171" }}>Add everyone who travels with you — kids, adults, grandparents, whoever.</p>
        <p className="text-sm" style={{ color: "#717171" }}>No kids? No problem — just add the adults.</p>
      </div>

      <div className="space-y-3">
        {members.map((m, i) => (
          <MemberCard
            key={i}
            member={m}
            index={i}
            onChange={(updated) => updateMember(i, updated)}
            onRemove={() => removeMember(i)}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => addMember("ADULT")}
          className="h-12 rounded-2xl border-2 border-dashed font-medium text-sm transition-all"
          style={{ borderColor: "#EEEEEE", color: "#717171" }}
        >
          + Add adult
        </button>
        <button
          onClick={() => addMember("CHILD")}
          className="h-12 rounded-2xl border-2 border-dashed font-medium text-sm transition-all"
          style={{ borderColor: "#EEEEEE", color: "#717171" }}
        >
          + Add child
        </button>
      </div>

      <button
        onClick={() => onNext({ members })}
        disabled={members.length === 0}
        className="w-full font-semibold rounded-full transition-colors"
        style={{
          height: "52px",
          fontSize: "16px",
          backgroundColor: members.length > 0 ? "#C4664A" : "#EEEEEE",
          color: members.length > 0 ? "#fff" : "#aaa",
          cursor: members.length > 0 ? "pointer" : "not-allowed",
        }}
      >
        Continue →
      </button>
    </div>
  );
}
