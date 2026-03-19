"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const AIRLINES = [
  "United MileagePlus", "Delta SkyMiles", "American AAdvantage",
  "British Airways Avios", "Southwest Rapid Rewards", "Air Canada Aeroplan",
  "Emirates Skywards", "Alaska Mileage Plan",
];

const HOTELS = [
  "Marriott Bonvoy", "Hilton Honors", "World of Hyatt",
  "IHG One Rewards", "Wyndham Rewards", "Choice Privileges", "Best Western Rewards",
];

const CAR_RENTAL = [
  "Hertz Gold Plus", "National Emerald Club", "Enterprise Plus",
  "Avis Preferred", "Budget Fastbreak", "Alamo Insiders",
];

interface LoyaltyEntry {
  id: string;
  program: string;
  memberNumber: string;
  programType: string;
}

export function LoyaltySection() {
  const [loyaltyPrograms, setLoyaltyPrograms] = useState<LoyaltyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<"airline" | "hotel" | "car">("airline");
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [memberNumber, setMemberNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/profile/loyalty")
      .then((r) => r.json())
      .then((data: Array<{ id: string; programName: string; memberNumber: string; programType: string }>) => {
        if (!Array.isArray(data)) return;
        setLoyaltyPrograms(
          data.map((p) => ({
            id: p.id,
            program: p.programName,
            memberNumber: p.memberNumber,
            programType: p.programType,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAddLoyalty = async () => {
    if (!selectedProgram || !memberNumber.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/profile/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programName: selectedProgram,
          memberNumber: memberNumber.trim(),
          programType: activeCategory,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const saved = await res.json();
      setLoyaltyPrograms((prev) => [
        ...prev,
        {
          id: saved.id,
          program: saved.programName,
          memberNumber: saved.memberNumber,
          programType: saved.programType,
        },
      ]);
      setMemberNumber("");
      setSelectedProgram(null);
    } catch (err) {
      console.error("Loyalty save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  async function handleRemove(id: string) {
    await fetch(`/api/profile/loyalty?id=${id}`, { method: "DELETE" });
    setLoyaltyPrograms((prev) => prev.filter((e) => e.id !== id));
  }

  function handleUpdateNumber(id: string, newMemberNumber: string) {
    setLoyaltyPrograms((prev) =>
      prev.map((e) => (e.id === id ? { ...e, memberNumber: newMemberNumber } : e))
    );
  }

  const PROGRAMS_BY_CATEGORY = {
    airline: AIRLINES,
    hotel: HOTELS,
    car: CAR_RENTAL,
  };

  const CATEGORY_LABELS = {
    airline: "Airlines",
    hotel: "Hotels",
    car: "Car Rental",
  };

  const currentPrograms = loyaltyPrograms.filter((e) => e.programType === activeCategory);
  const addedNames = new Set(currentPrograms.map((e) => e.program));
  const availablePrograms = PROGRAMS_BY_CATEGORY[activeCategory].filter((p) => !addedNames.has(p));

  if (loading) return <p style={{ color: "#717171", fontSize: "14px" }}>Loading...</p>;

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E8E8E8", padding: "24px" }}>
      {/* Category tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {(["airline", "hotel", "car"] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              setSelectedProgram(null);
              setMemberNumber("");
            }}
            style={{
              padding: "6px 14px",
              borderRadius: "999px",
              fontSize: "13px",
              fontWeight: 500,
              border: `1px solid ${activeCategory === cat ? "#1B3A5C" : "#E8E8E8"}`,
              backgroundColor: activeCategory === cat ? "#1B3A5C" : "#fff",
              color: activeCategory === cat ? "#fff" : "#717171",
              cursor: "pointer",
            }}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Added programs */}
      {currentPrograms.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
          {currentPrograms.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                backgroundColor: "#fff", border: "1px solid #E8E8E8",
                borderRadius: "8px", padding: "10px 14px",
              }}
            >
              <span style={{ flex: "0 0 auto", fontSize: "14px", fontWeight: 500, color: "#1B3A5C", minWidth: "160px" }}>
                {entry.program}
              </span>
              <input
                value={entry.memberNumber}
                onChange={(e) => handleUpdateNumber(entry.id, e.target.value)}
                onBlur={async (e) => {
                  await fetch(`/api/profile/loyalty?id=${entry.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ memberNumber: e.target.value }),
                  });
                }}
                placeholder="Member number"
                style={{
                  flex: 1, border: "none", outline: "none", fontSize: "14px",
                  color: "#1a1a1a", backgroundColor: "transparent",
                }}
              />
              <button
                onClick={() => handleRemove(entry.id)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
              >
                <X size={15} style={{ color: "#717171" }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Program pill selection */}
      <p style={{ fontSize: "13px", fontWeight: 600, color: "#717171", marginBottom: "8px" }}>
        Select a program
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
        {availablePrograms.map((p) => (
          <button
            key={p}
            onClick={() => setSelectedProgram(selectedProgram === p ? null : p)}
            style={{
              border: `1px solid ${selectedProgram === p ? "#1B3A5C" : "#E8E8E8"}`,
              borderRadius: "999px",
              padding: "5px 12px",
              fontSize: "13px",
              color: selectedProgram === p ? "#1B3A5C" : "#717171",
              backgroundColor: selectedProgram === p ? "#EEF2F7" : "#fff",
              cursor: "pointer",
              fontWeight: selectedProgram === p ? 600 : 400,
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Member number + Add button — shown when a program is selected */}
      {selectedProgram && (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <p style={{ fontSize: "12px", color: "#717171", marginBottom: "4px" }}>
              Member number for <strong>{selectedProgram}</strong>
            </p>
            <input
              value={memberNumber}
              onChange={(e) => setMemberNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddLoyalty()}
              placeholder="Enter member number"
              autoFocus
              style={{
                width: "100%", padding: "8px 12px", border: "1px solid #E8E8E8",
                borderRadius: "8px", fontSize: "14px", color: "#1a1a1a", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <button
            onClick={handleAddLoyalty}
            disabled={isSaving || !memberNumber.trim()}
            style={{
              padding: "8px 16px",
              backgroundColor: memberNumber.trim() ? "#1B3A5C" : "#E8E8E8",
              color: memberNumber.trim() ? "#fff" : "#aaa",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: memberNumber.trim() && !isSaving ? "pointer" : "not-allowed",
              flexShrink: 0,
              marginTop: "20px",
            }}
          >
            {isSaving ? "Saving..." : "+ Add"}
          </button>
        </div>
      )}

      {/* Custom program search */}
      {!selectedProgram && (
        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          <input
            placeholder="Not listed? Type program name..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                setSelectedProgram((e.target as HTMLInputElement).value.trim());
              }
            }}
            style={{
              flex: 1, padding: "8px 12px", border: "1px solid #E8E8E8",
              borderRadius: "8px", fontSize: "14px", color: "#1a1a1a", outline: "none",
            }}
          />
        </div>
      )}
    </div>
  );
}
