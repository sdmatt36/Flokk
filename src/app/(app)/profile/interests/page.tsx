"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check } from "lucide-react";
import Link from "next/link";
import { INTERESTS, INTEREST_CATEGORIES } from "@/types";

const MIN_SELECTIONS = 3;

export default function ProfileInterestsPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load current interests
  useEffect(() => {
    fetch("/api/profile/interests")
      .then((r) => r.json())
      .then((data) => {
        if (data.interestKeys) setSelected(data.interestKeys);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const filtered =
    activeCategory === "ALL"
      ? INTERESTS
      : INTERESTS.filter((i) => i.category === activeCategory);

  const canSave = selected.length >= MIN_SELECTIONS;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/interests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interestKeys: selected }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      router.push("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FFFFFF" }}>
      {/* Header */}
      <div
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4 border-b"
        style={{ backgroundColor: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", borderColor: "#EEEEEE" }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link
            href="/home"
            style={{ display: "flex", alignItems: "center", gap: "4px", color: "#717171", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}
          >
            <ChevronLeft size={16} />
            Back
          </Link>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a" }}>Edit Interests</span>
          <div style={{ width: "48px" }} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 pt-24 pb-8 px-6">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-black" style={{ color: "#1a1a1a" }}>What excites your family?</h1>
            <p style={{ fontSize: "13px", fontWeight: 600, color: canSave ? "#6B8F71" : "#717171" }}>
              {selected.length < MIN_SELECTIONS
                ? `Pick at least ${MIN_SELECTIONS} — ${MIN_SELECTIONS - selected.length} more to go`
                : `${selected.length} selected`}
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
          {loading ? (
            <div style={{ textAlign: "center", color: "#999", padding: "40px 0" }}>Loading...</div>
          ) : (
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
          )}

          {error && <p className="text-sm text-center" style={{ color: "#C4664A" }}>{error}</p>}
        </div>
      </div>

      {/* Sticky save button */}
      <div
        className="sticky bottom-0 px-6 pt-4 pb-8"
        style={{ backgroundColor: "#fff", borderTop: "1px solid #EEEEEE" }}
      >
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full font-semibold rounded-full transition-colors"
            style={{
              height: "52px",
              fontSize: "16px",
              backgroundColor: canSave ? "#C4664A" : "#EEEEEE",
              color: canSave ? "#fff" : "#717171",
              cursor: canSave && !saving ? "pointer" : "not-allowed",
            }}
          >
            {saving ? "Saving..." : "Save interests"}
          </button>
        </div>
      </div>
    </div>
  );
}
