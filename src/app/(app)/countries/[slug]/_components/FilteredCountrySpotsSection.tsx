"use client";

import { useState, useMemo } from "react";
import { Playfair_Display } from "next/font/google";
import { CommunitySpotCard } from "@/components/shared/cards/CommunitySpotCard";
import { QuickAddModal } from "@/components/shared/QuickAddModal";
import { CATEGORIES } from "@/lib/categories";
import { CategoryFilterChips } from "@/components/shared/CategoryFilterChips";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"], display: "swap" });

const TERRA = "#C4664A";
const NAVY = "#1B3A5C";

const GRID_CSS = `
  .filtered-spots-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  @media (max-width: 900px) {
    .filtered-spots-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 500px) {
    .filtered-spots-grid { grid-template-columns: 1fr; }
  }
`;

export interface CountrySpot {
  id: string;
  name: string;
  city: string;
  category: string | null;
  photoUrl: string | null;
  shareToken: string | null;
  averageRating: number | null;
  ratingCount: number;
  description: string | null;
}

interface Props {
  spots: CountrySpot[];
  id?: string;
  title?: string;
  emptyText?: string;
}

function categoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug.replace(/_/g, " ");
}

export function FilteredCountrySpotsSection({
  spots,
  id,
  title = "Flokk Picks",
  emptyText = "No picks yet.",
}: Props) {
  const [search, setSearch] = useState("");
  const [activeCity, setActiveCity] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const cities = useMemo(() => {
    const seen = new Set<string>();
    return spots
      .map((s) => s.city)
      .filter((c): c is string => !!c && !seen.has(c) && !!seen.add(c))
      .sort();
  }, [spots]);

  const categories = useMemo(() => {
    const seen = new Map<string, number>();
    for (const s of spots) {
      if (s.category) seen.set(s.category, (seen.get(s.category) ?? 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }, [spots]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return spots.filter((s) => {
      if (q && !`${s.name} ${s.city}`.toLowerCase().includes(q)) return false;
      if (activeCity && s.city !== activeCity) return false;
      if (activeCategory && s.category !== activeCategory) return false;
      return true;
    });
  }, [spots, search, activeCity, activeCategory]);

  const LIMIT = 8;
  const visible = expanded ? filtered : filtered.slice(0, LIMIT);
  const hiddenCount = filtered.length - LIMIT;

  function resetFilters() {
    setSearch("");
    setActiveCity("");
    setActiveCategory(null);
    setExpanded(false);
  }

  const hasActiveFilter = search || activeCity || activeCategory;

  return (
    <section
      id={id}
      style={{ paddingTop: "48px", paddingBottom: "8px", scrollMarginTop: "108px" }}
    >
      <style>{GRID_CSS}</style>

      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "12px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <h2
            className={playfair.className}
            style={{ fontSize: "22px", fontWeight: 700, color: NAVY, margin: 0 }}
          >
            {title}
          </h2>
          {spots.length > 0 && (
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: TERRA,
                backgroundColor: "#FFF3EE",
                borderRadius: "20px",
                padding: "2px 10px",
              }}
            >
              {spots.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: TERRA,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          + Pick
        </button>
      </div>

      {/* Filter bar */}
      {spots.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              marginBottom: "10px",
              alignItems: "center",
            }}
          >
            <input
              type="text"
              placeholder="Search picks..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setExpanded(false);
              }}
              style={{
                flex: "1 1 160px",
                minWidth: "140px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #E5E7EB",
                fontSize: "13px",
                color: "#1a1a1a",
                outline: "none",
                fontFamily: "inherit",
                backgroundColor: "#fff",
              }}
            />
            {cities.length > 1 && (
              <select
                value={activeCity}
                onChange={(e) => {
                  setActiveCity(e.target.value);
                  setExpanded(false);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                  fontSize: "13px",
                  color: activeCity ? "#1a1a1a" : "#888",
                  background: "#fff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <option value="">All cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
            {hasActiveFilter && (
              <button
                onClick={resetFilters}
                style={{
                  fontSize: "12px",
                  color: "#888",
                  background: "none",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Category chips */}
          {categories.length >= 2 && (
            <div style={{ marginBottom: "12px" }}>
              <CategoryFilterChips
                selected={activeCategory}
                available={categories.map(([slug, count]) => ({
                  slug,
                  label: categoryLabel(slug),
                  count,
                }))}
                onSelect={(s) => { setActiveCategory(s); setExpanded(false); }}
              />
            </div>
          )}
        </>
      )}

      {/* Grid or empty state */}
      {spots.length === 0 ? (
        <div
          style={{
            padding: "32px 24px",
            backgroundColor: "#FAFAFA",
            borderRadius: "12px",
            border: "1px dashed #E5E7EB",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "14px", color: "#9CA3AF", margin: 0 }}>{emptyText}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: "32px 24px",
            backgroundColor: "#FAFAFA",
            borderRadius: "12px",
            border: "1px dashed #E5E7EB",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "14px", color: "#9CA3AF", margin: 0 }}>
            No picks match your filters.
          </p>
        </div>
      ) : (
        <>
          <div className="filtered-spots-grid">
            {visible.map((spot) => (
              <CommunitySpotCard
                key={spot.id}
                spot={{
                  id: spot.id,
                  title: spot.name,
                  city: spot.city,
                  photoUrl: spot.photoUrl,
                  category: spot.category,
                  rating: spot.averageRating ? Math.round(spot.averageRating) : null,
                  ratingCount: spot.ratingCount,
                  description: spot.description,
                  shareToken: spot.shareToken,
                }}
                href={spot.shareToken ? `/spots/${spot.shareToken}` : undefined}
              />
            ))}
          </div>
          {!expanded && hiddenCount > 0 && (
            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <button
                onClick={() => setExpanded(true)}
                style={{
                  fontSize: "13px",
                  color: TERRA,
                  background: "none",
                  border: `1px solid ${TERRA}`,
                  borderRadius: "20px",
                  padding: "8px 20px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Show {hiddenCount} more
              </button>
            </div>
          )}
        </>
      )}

      <QuickAddModal isOpen={modalOpen} defaultTab="pick" onClose={() => setModalOpen(false)} />
    </section>
  );
}
