"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepFamilyBasics } from "@/components/features/family/StepFamilyBasics";
import { StepFamilyMembers } from "@/components/features/family/StepFamilyMembers";
import { StepInterests } from "@/components/features/family/StepInterests";
import { Progress } from "@/components/ui/progress";

export type FamilyMemberInput = {
  role: "ADULT" | "CHILD";
  name?: string;
  birthDate?: string;
  dietaryRequirements: string[];
  foodAllergies: string[];
  allergyNotes?: string;
};

export type OnboardingData = {
  familyName: string;
  homeCity: string;
  homeCountry: string;
  travelFrequency: string;
  members: FamilyMemberInput[];
  interestKeys: string[];
};

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    familyName: "",
    homeCity: "",
    homeCountry: "",
    travelFrequency: "",
    members: [],
    interestKeys: [],
  });

  const progress = (step / TOTAL_STEPS) * 100;

  const handleNext = (update: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...update }));
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => setStep((s) => s - 1);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async (update: Partial<OnboardingData>) => {
    const final = { ...data, ...update };
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(final),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        const msg = Array.isArray(errorData.error)
          ? errorData.error.map((e: { message?: string }) => e.message ?? JSON.stringify(e)).join("; ")
          : errorData.error ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }
      router.push("/home");
    } catch (err) {
      console.error("Onboarding submit error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FFFFFF" }}>
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 px-6 py-4 border-b" style={{ backgroundColor: "rgba(245,239,224,0.95)", backdropFilter: "blur(8px)", borderColor: "#EEEEEE" }}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#C4664A" }}>
              Step {step} of {TOTAL_STEPS}
            </span>
            {step > 1 && (
              <button
                onClick={handleBack}
                className="text-sm font-medium transition-colors"
                style={{ color: "#999" }}
              >
                ← Back
              </button>
            )}
          </div>
          {/* Custom progress bar */}
          <div className="h-1 rounded-full" style={{ backgroundColor: "#EEEEEE" }}>
            <div
              className="h-1 rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: "#C4664A" }}
            />
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 pt-24 pb-8 px-6">
        <div className="max-w-lg mx-auto">
          {step === 1 && (
            <StepFamilyBasics data={data} onNext={(update) => handleNext(update)} />
          )}
          {step === 2 && (
            <StepFamilyMembers data={data} onNext={(update) => handleNext(update)} />
          )}
          {step === 3 && (
            <StepInterests data={data} onComplete={(update) => handleComplete(update)} saving={saving} error={error} />
          )}
        </div>
      </div>
    </div>
  );
}
