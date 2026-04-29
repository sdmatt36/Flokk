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
      // Recover share intent set before sign-up
      const INTENT_KEY = "flokk_share_intent";
      const INTENT_TTL_MS = 10 * 60 * 1000;
      try {
        const raw = localStorage.getItem(INTENT_KEY);
        if (raw) {
          const intent = JSON.parse(raw) as { token?: string; ts?: number };
          if (intent.token && intent.ts && Date.now() - intent.ts < INTENT_TTL_MS) {
            localStorage.removeItem(INTENT_KEY);
            router.push(`/s/${intent.token}`);
            return;
          }
          localStorage.removeItem(INTENT_KEY);
        }
      } catch {
        // localStorage unavailable — fall through to /home
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
          <div style={{ marginTop: 40, padding: "20px 24px", background: "#FFF8F3", border: "1px solid #E8D5C8", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#C4664A", marginBottom: 10 }}>
              From a Flokk family
            </div>
            <div style={{ fontStyle: "italic", fontSize: 14, lineHeight: 1.5, color: "#333", marginBottom: 8 }}>
              &ldquo;Holy Crap, I just got a shiver it&rsquo;s so amazing. The packing section alone is so
              helpful and how it knows the temp where you are going and what to pack for kids...Love love
              love it!&rdquo;
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>Kristin, Washington State</div>
          </div>
        </div>
      </div>
    </div>
  );
}
