"use client";

import { useState } from "react";
import { DM_Sans } from "next/font/google";
import { CountryCityCard } from "./CountryCityCard";

const dmSans = DM_Sans({ subsets: ["latin"], display: "swap" });

const GRID_CSS = `
  .ccg-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  @media (max-width: 900px) {
    .ccg-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 500px) {
    .ccg-grid { grid-template-columns: 1fr; }
  }
`;

const PAGE_SIZE = 12;

interface City {
  id: string;
  slug: string;
  name: string;
  photoUrl: string | null;
  heroPhotoUrl: string | null;
  spotCount: number;
}

interface CountryCityGridProps {
  cities: City[];
  countryName: string;
}

export function CountryCityGrid({ cities }: CountryCityGridProps) {
  const [expanded, setExpanded] = useState(false);

  const totalCount = cities.length;
  const visible = expanded ? cities : cities.slice(0, PAGE_SIZE);
  const showExpandBtn = !expanded && totalCount > PAGE_SIZE;
  const showCollapseBtn = expanded && totalCount > PAGE_SIZE;

  return (
    <div>
      <style>{GRID_CSS}</style>

      {visible.length > 0 && (
        <div className="ccg-grid">
          {visible.map((city) => (
            <CountryCityCard
              key={city.id}
              slug={city.slug}
              name={city.name}
              photoUrl={city.heroPhotoUrl ?? city.photoUrl}
              spotCount={city.spotCount}
            />
          ))}
        </div>
      )}

      {(showExpandBtn || showCollapseBtn) && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          {showExpandBtn ? (
            <button
              className={dmSans.className}
              onClick={() => setExpanded(true)}
              style={{
                fontSize: 13,
                color: "#C4664A",
                background: "none",
                border: "1px solid #C4664A",
                borderRadius: 20,
                padding: "8px 20px",
                cursor: "pointer",
              }}
            >
              Show all {totalCount} cities
            </button>
          ) : (
            <button
              className={dmSans.className}
              onClick={() => setExpanded(false)}
              style={{
                fontSize: 13,
                color: "#C4664A",
                background: "none",
                border: "1px solid #C4664A",
                borderRadius: 20,
                padding: "8px 20px",
                cursor: "pointer",
              }}
            >
              Show fewer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
