"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import { SpotCard, type CompactSpotCardProps } from "./cards";
import { CATEGORIES } from "@/lib/categories";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"] });

const GRID_CSS = `
  .spot-section-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  @media (max-width: 900px) {
    .spot-section-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 500px) {
    .spot-section-grid { grid-template-columns: 1fr; }
  }
`;

type SortKey = "top-rated" | "most-rated";

interface SpotSectionProps {
  id: string;
  title: string;
  spots: CompactSpotCardProps[];
  cityName: string;
  addHref?: string;
  emptyText: string;
  showCategoryFilter?: boolean;
}

function categoryLabel(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug.replace(/_/g, " ");
}

export function SpotSection({
  id,
  title,
  spots,
  cityName: _cityName,
  addHref = "/discover/spots",
  emptyText,
  showCategoryFilter = false,
}: SpotSectionProps) {
  const [sort, setSort] = useState<SortKey>("top-rated");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const presentCategories = useMemo(
    () => [...new Set(spots.map((s) => s.category).filter(Boolean))] as string[],
    [spots]
  );

  const filtered = activeCategory
    ? spots.filter((s) => s.category === activeCategory)
    : spots;

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      sort === "top-rated"
        ? (b.averageRating ?? 0) - (a.averageRating ?? 0)
        : b.ratingCount - a.ratingCount
    );
  }, [filtered, sort]);

  const visible = expanded ? sorted : sorted.slice(0, 8);
  const hiddenCount = sorted.length - 8;

  return (
    <section id={id} style={{ paddingTop: "48px", paddingBottom: "8px", scrollMarginTop: "108px" }}>
      <style>{GRID_CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
          <h2
            className={playfair.className}
            style={{ fontSize: "22px", fontWeight: 700, color: "#1B3A5C", margin: 0 }}
          >
            {title}
          </h2>
          {spots.length > 0 && (
            <span style={{
              fontSize: "12px", fontWeight: 600, color: "#C4664A",
              backgroundColor: "#FFF3EE", borderRadius: "20px", padding: "2px 10px",
            }}>
              {spots.length}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
          {spots.length > 0 && (
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as SortKey); setExpanded(false); }}
              style={{
                fontSize: "12px", color: "#666",
                border: "1px solid #E5E7EB", borderRadius: "8px",
                padding: "3px 8px", cursor: "pointer", background: "#fff",
              }}
            >
              <option value="top-rated">Top rated</option>
              <option value="most-rated">Most rated</option>
            </select>
          )}
          <Link href={addHref} style={{ fontSize: "13px", color: "#888", textDecoration: "none", flexShrink: 0 }}>
            Add →
          </Link>
        </div>
      </div>

      {spots.length === 0 ? (
        <div style={{
          padding: "32px 24px", backgroundColor: "#FAFAFA",
          borderRadius: "12px", border: "1px dashed #E5E7EB",
          textAlign: "center",
        }}>
          <p style={{ fontSize: "14px", color: "#9CA3AF", margin: 0 }}>{emptyText}</p>
        </div>
      ) : (
        <>
          {/* Category filter pills (Activities section only) */}
          {showCategoryFilter && presentCategories.length > 1 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
              <button
                onClick={() => { setActiveCategory(null); setExpanded(false); }}
                style={{
                  fontSize: "12px", padding: "4px 12px", borderRadius: "20px",
                  border: `1px solid ${activeCategory === null ? "#C4664A" : "#E5E7EB"}`,
                  backgroundColor: activeCategory === null ? "#FFF3EE" : "#fff",
                  color: activeCategory === null ? "#C4664A" : "#666",
                  fontWeight: activeCategory === null ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                All
              </button>
              {presentCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(activeCategory === cat ? null : cat); setExpanded(false); }}
                  style={{
                    fontSize: "12px", padding: "4px 12px", borderRadius: "20px",
                    border: `1px solid ${activeCategory === cat ? "#C4664A" : "#E5E7EB"}`,
                    backgroundColor: activeCategory === cat ? "#FFF3EE" : "#fff",
                    color: activeCategory === cat ? "#C4664A" : "#666",
                    fontWeight: activeCategory === cat ? 600 : 400,
                    cursor: "pointer", textTransform: "capitalize",
                  }}
                >
                  {categoryLabel(cat)}
                </button>
              ))}
            </div>
          )}

          {/* Grid */}
          <div className="spot-section-grid">
            {visible.map((spot) => (
              <SpotCard key={spot.id} spot={spot} />
            ))}
          </div>

          {/* Show more */}
          {!expanded && hiddenCount > 0 && (
            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <button
                onClick={() => setExpanded(true)}
                style={{
                  fontSize: "13px", color: "#C4664A", background: "none",
                  border: "1px solid #C4664A", borderRadius: "20px",
                  padding: "8px 20px", cursor: "pointer",
                }}
              >
                Show {hiddenCount} more
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
