"use client";

import { useState } from "react";
import type { OnboardingData } from "@/app/(app)/onboarding/page";

const FREQUENCY_OPTIONS = [
  { value: "ONE_TWO", label: "1–2 times a year" },
  { value: "THREE_FIVE", label: "3–5 times a year" },
  { value: "SIX_PLUS", label: "6+ times a year" },
];

interface Props {
  data: OnboardingData;
  onNext: (update: Partial<OnboardingData>) => void;
}

export function StepFamilyBasics({ data, onNext }: Props) {
  const [familyName, setFamilyName] = useState(data.familyName);
  const [homeCity, setHomeCity] = useState(data.homeCity);
  const [homeCountry, setHomeCountry] = useState(data.homeCountry);
  const [travelFrequency, setTravelFrequency] = useState(data.travelFrequency);

  const canContinue = homeCity.trim() && homeCountry.trim() && travelFrequency;

  const inputStyle = {
    height: "48px",
    fontSize: "15px",
    padding: "0 14px",
    borderRadius: "12px",
    border: "1.5px solid #EEEEEE",
    backgroundColor: "#fff",
    color: "#1a1a1a",
    width: "100%",
    outline: "none",
  };

  return (
    <div className="space-y-8 pt-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-black" style={{ color: "#1a1a1a" }}>Let&apos;s get started.</h1>
        <p className="text-lg" style={{ color: "#717171" }}>A few quick details — takes about 60 seconds.</p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-semibold" style={{ color: "#2d2d2d" }}>
            Family name <span className="font-normal" style={{ color: "#717171" }}>(optional)</span>
          </label>
          <input
            placeholder="e.g. The Johnsons"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold" style={{ color: "#2d2d2d" }}>Home city</label>
            <input
              placeholder="e.g. Chicago"
              value={homeCity}
              onChange={(e) => setHomeCity(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold" style={{ color: "#2d2d2d" }}>Country</label>
            <input
              placeholder="e.g. USA"
              value={homeCountry}
              onChange={(e) => setHomeCountry(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold" style={{ color: "#2d2d2d" }}>How often does your family travel?</label>
          <div className="space-y-2">
            {FREQUENCY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTravelFrequency(opt.value)}
                className="w-full text-left px-5 py-3.5 rounded-2xl border-2 transition-all text-base font-medium"
                style={{
                  borderColor: travelFrequency === opt.value ? "#C4664A" : "#EEEEEE",
                  backgroundColor: travelFrequency === opt.value ? "#C4664A" : "#fff",
                  color: travelFrequency === opt.value ? "#fff" : "#2d2d2d",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={() => onNext({ familyName, homeCity, homeCountry, travelFrequency })}
        disabled={!canContinue}
        className="w-full font-semibold rounded-full transition-colors"
        style={{
          height: "52px",
          fontSize: "16px",
          backgroundColor: canContinue ? "#C4664A" : "#EEEEEE",
          color: canContinue ? "#fff" : "#aaa",
          cursor: canContinue ? "pointer" : "not-allowed",
        }}
      >
        Continue →
      </button>
    </div>
  );
}
