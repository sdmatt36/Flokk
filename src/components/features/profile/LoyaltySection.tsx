"use client";

import { useState } from "react";
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
  program: string;
  memberNumber: string;
}

interface CategoryState {
  added: LoyaltyEntry[];
  search: string;
}

function LoyaltyCategory({
  title,
  programs,
  state,
  onChange,
}: {
  title: string;
  programs: string[];
  state: CategoryState;
  onChange: (s: CategoryState) => void;
}) {
  const addedNames = new Set(state.added.map((e) => e.program));

  function addProgram(name: string) {
    if (addedNames.has(name)) return;
    onChange({ ...state, added: [...state.added, { program: name, memberNumber: "" }] });
  }

  function removeProgram(name: string) {
    onChange({ ...state, added: state.added.filter((e) => e.program !== name) });
  }

  function updateNumber(program: string, memberNumber: string) {
    onChange({
      ...state,
      added: state.added.map((e) => (e.program === program ? { ...e, memberNumber } : e)),
    });
  }

  function handleAdd() {
    const name = state.search.trim();
    if (!name) return;
    addProgram(name);
    onChange({ ...state, search: "", added: [...state.added, { program: name, memberNumber: "" }] });
  }

  return (
    <div style={{ marginBottom: "32px" }}>
      <p style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", marginBottom: "12px" }}>{title}</p>

      {state.added.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
          {state.added.map((entry) => (
            <div key={entry.program} style={{
              display: "flex", alignItems: "center", gap: "12px",
              backgroundColor: "#fff", border: "1px solid #E8E8E8",
              borderRadius: "8px", padding: "10px 14px",
            }}>
              <span style={{ flex: "0 0 auto", fontSize: "14px", fontWeight: 500, color: "#1B3A5C", minWidth: "160px" }}>
                {entry.program}
              </span>
              <input
                value={entry.memberNumber}
                onChange={(e) => updateNumber(entry.program, e.target.value)}
                placeholder="Member number (optional)"
                style={{
                  flex: 1, border: "none", outline: "none", fontSize: "14px",
                  color: "#1a1a1a", backgroundColor: "transparent",
                }}
              />
              <button onClick={() => removeProgram(entry.program)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                <X size={15} style={{ color: "#717171" }} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
        {programs.filter((p) => !addedNames.has(p)).map((p) => (
          <button
            key={p}
            onClick={() => addProgram(p)}
            style={{
              border: "1px solid #E8E8E8", borderRadius: "999px",
              padding: "5px 12px", fontSize: "13px", color: "#717171",
              backgroundColor: "#fff", cursor: "pointer",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <input
          value={state.search}
          onChange={(e) => onChange({ ...state, search: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Search programs..."
          style={{
            flex: 1, padding: "8px 12px", border: "1px solid #E8E8E8",
            borderRadius: "8px", fontSize: "14px", color: "#1a1a1a", outline: "none",
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            padding: "8px 16px", backgroundColor: "#1B3A5C", color: "#fff",
            border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer",
          }}
        >
          + Add
        </button>
      </div>
    </div>
  );
}

const empty = (): CategoryState => ({ added: [], search: "" });

export function LoyaltySection() {
  const [airlines, setAirlines] = useState<CategoryState>(empty);
  const [hotels, setHotels] = useState<CategoryState>(empty);
  const [cars, setCars] = useState<CategoryState>(empty);

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E8E8E8", padding: "24px" }}>
      <LoyaltyCategory title="Airlines" programs={AIRLINES} state={airlines} onChange={setAirlines} />
      <LoyaltyCategory title="Hotels" programs={HOTELS} state={hotels} onChange={setHotels} />
      <LoyaltyCategory title="Car Rental" programs={CAR_RENTAL} state={cars} onChange={setCars} />
    </div>
  );
}
