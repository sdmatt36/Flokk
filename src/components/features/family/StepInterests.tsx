"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { INTERESTS, INTEREST_CATEGORIES } from "@/types";
import type { OnboardingData } from "@/app/(app)/onboarding/page";

const MIN_SELECTIONS = 3;

interface Props {
  data: OnboardingData;
  onComplete: (update: Partial<OnboardingData>) => void;
  saving?: boolean;
  error?: string | null;
}

export function StepInterests({ data, onComplete, saving, error }: Props) {
  const [selected, setSelected] = useState<string[]>(data.interestKeys);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const filtered =
    activeCategory === "ALL"
      ? INTERESTS
      : INTERESTS.filter((i) => i.category === activeCategory);

  const canComplete = selected.length >= MIN_SELECTIONS;

  return (
    <div className="space-y-6 pt-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-black" style={{ color: "#1a1a1a" }}>What excites your family?</h1>
        <p className="text-lg" style={{ color: "#717171" }}>Pick everything that sounds like you. No wrong answers.</p>
        <p className="text-sm font-medium" style={{ color: canComplete ? "#6B8F71" : "#717171" }}>
          {selected.length < MIN_SELECTIONS
            ? `Pick at least ${MIN_SELECTIONS} — ${MIN_SELECTIONS - selected.length} more to go`
            : `${selected.length} selected — nice taste.`}
        </p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-6 px-6">
        {[{ key: "ALL", label: "All" }, ...INTEREST_CATEGORIES].map((cat) => {
          const active = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all"
              style={{
                backgroundColor: active ? "#C4664A" : "#fff",
                color: active ? "#fff" : "#717171",
                border: `1.5px solid ${active ? "#C4664A" : "#EEEEEE"}`,
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Interest tiles */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((interest) => {
          const isSelected = selected.includes(interest.key);
          return (
            <button
              key={interest.key}
              onClick={() => toggle(interest.key)}
              className="relative text-left p-4 rounded-2xl border-2 transition-all"
              style={{
                borderColor: isSelected ? "#C4664A" : "#EEEEEE",
                backgroundColor: isSelected ? "#C4664A" : "#fff",
                color: isSelected ? "#fff" : "#2d2d2d",
              }}
            >
              <span className="text-sm font-semibold leading-tight block">{interest.label}</span>
              {isSelected && (
                <span className="absolute top-2.5 right-2.5">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-center" style={{ color: "#C4664A" }}>{error}</p>}

      <div className="sticky bottom-0 pt-4 pb-2" style={{ backgroundColor: "#FFFFFF" }}>
        <button
          onClick={() => onComplete({ interestKeys: selected })}
          disabled={!canComplete || saving}
          className="w-full font-semibold rounded-full transition-colors"
          style={{
            height: "52px",
            fontSize: "16px",
            backgroundColor: canComplete ? "#C4664A" : "#EEEEEE",
            color: canComplete ? "#fff" : "#717171",
            cursor: canComplete && !saving ? "pointer" : "not-allowed",
          }}
        >
          {saving ? "Saving..." : canComplete ? "Let's go →" : `${MIN_SELECTIONS - selected.length} more to continue`}
        </button>
      </div>
    </div>
  );
}
