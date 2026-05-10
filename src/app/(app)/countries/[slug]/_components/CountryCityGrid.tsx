"use client";

import { useState, useRef } from "react";
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

export function CountryCityGrid({ cities, countryName }: CountryCityGridProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(val: string) {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(val), 150);
  }

  const trimmed = debouncedQuery.trim();
  const isSearching = trimmed.length > 0;

  const filtered = isSearching
    ? cities.filter((c) => c.name.toLowerCase().includes(trimmed.toLowerCase()))
    : cities;

  const visible = isSearching || expanded ? filtered : filtered.slice(0, PAGE_SIZE);
  const totalCount = cities.length;
  const showExpandBtn = !isSearching && !expanded && totalCount > PAGE_SIZE;
  const showCollapseBtn = !isSearching && expanded && totalCount > PAGE_SIZE;

  return (
    <div>
      <style>{GRID_CSS}</style>

      {/* Search — only shown when there are more cities than the default page */}
      {totalCount > PAGE_SIZE && (
        <div style={{ marginBottom: 20, position: "relative", maxWidth: 360 }}>
          <input
            className={dmSans.className}
            type="text"
            placeholder={`Search cities in ${countryName}…`}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            style={{
              width: "100%",
              fontSize: 16,
              padding: "10px 36px 10px 12px",
              border: "1px solid #1B3A5C",
              borderRadius: 8,
              outline: "none",
              backgroundColor: "#fff",
              color: "#0A1628",
              boxSizing: "border-box",
            }}
          />
          {query && (
            <button
              onClick={() => handleQueryChange("")}
              aria-label="Clear search"
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                color: "#999",
                padding: 4,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {visible.length > 0 ? (
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
      ) : isSearching ? (
        <div
          style={{
            padding: "32px 24px",
            backgroundColor: "#FAFAFA",
            borderRadius: "12px",
            border: "1px dashed #E5E7EB",
            textAlign: "center",
          }}
        >
          <p className={dmSans.className} style={{ fontSize: 14, color: "#9CA3AF", margin: 0 }}>
            No cities matching &ldquo;{debouncedQuery}&rdquo; in {countryName}.
          </p>
        </div>
      ) : null}

      {/* Expand / collapse */}
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
