"use client";

import { useState, useMemo } from "react";
import { Playfair_Display } from "next/font/google";
import { CommunitySpotCard } from "@/components/shared/cards/CommunitySpotCard";
import { QuickAddModal } from "@/components/shared/QuickAddModal";
import { CATEGORIES } from "@/lib/categories";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"], display: "swap" });

const TERRA = "#C4664A";
const NAVY = "#1B3A5C";

const GRID_CSS = `
  .picks-browse-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  @media (max-width: 1024px) {
    .picks-browse-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 700px) {
    .picks-browse-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 480px) {
    .picks-browse-grid { grid-template-columns: 1fr; }
  }
`;

export type PicksBrowseSpot = {
  id: string;
  name: string;
  city: string;
  country: string | null;
  category: string | null;
  photoUrl: string | null;
  shareToken: string | null;
  averageRating: number | null;
  ratingCount: number;
  description: string | null;
  contributorName: string | null;
};

function categoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug.replace(/_/g, " ");
}

interface Props {
  spots: PicksBrowseSpot[];
}

const LIMIT = 12;

export function PicksBrowseSection({ spots }: Props) {
  const [search, setSearch] = useState("");
  const [activeCountry, setActiveCountry] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const countries = useMemo(() => {
    const seen = new Set<string>();
    return spots
      .map((s) => s.country)
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
      if (q && !`${s.name} ${s.city} ${s.country ?? ""}`.toLowerCase().includes(q)) return false;
      if (activeCountry && s.country !== activeCountry) return false;
      if (activeCategory && s.category !== activeCategory) return false;
      return true;
    });
  }, [spots, search, activeCountry, activeCategory]);

  const visible = expanded ? filtered : filtered.slice(0, LIMIT);
  const hiddenCount = filtered.length - LIMIT;

  function resetFilters() {
    setSearch("");
    setActiveCountry("");
    setActiveCategory("");
    setExpanded(false);
  }

  const hasActiveFilter = !!(search || activeCountry || activeCategory);

  return (
    <section style={{ paddingTop: "32px" }}>
      <style>{GRID_CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <h2
            className={playfair.className}
            style={{ fontSize: "22px", fontWeight: 700, color: NAVY, margin: 0 }}
          >
            All Picks
          </h2>
          <span style={{ fontSize: "12px", fontWeight: 600, color: TERRA, backgroundColor: "#FFF3EE", borderRadius: "20px", padding: "2px 10px" }}>
            {filtered.length}
          </span>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{ fontSize: "13px", fontWeight: 600, color: TERRA, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
        >
          + Pick
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search picks..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setExpanded(false); }}
          style={{
            flex: "1 1 200px", minWidth: "160px", padding: "8px 12px", borderRadius: "8px",
            border: "1px solid #E5E7EB", fontSize: "13px", color: "#1a1a1a",
            outline: "none", fontFamily: "inherit", backgroundColor: "#fff",
          }}
        />
        {countries.length > 1 && (
          <select
            value={activeCountry}
            onChange={(e) => { setActiveCountry(e.target.value); setExpanded(false); }}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #E5E7EB", fontSize: "13px", color: activeCountry ? "#1a1a1a" : "#888", background: "#fff", cursor: "pointer", fontFamily: "inherit" }}
          >
            <option value="">All countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {hasActiveFilter && (
          <button
            onClick={resetFilters}
            style={{ fontSize: "12px", color: "#888", background: "none", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Category chips */}
      {categories.length >= 2 && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "20px" }}>
          <button
            onClick={() => { setActiveCategory(""); setExpanded(false); }}
            style={{ fontSize: "12px", padding: "4px 12px", borderRadius: "20px", border: `1px solid ${activeCategory === "" ? TERRA : "#E5E7EB"}`, backgroundColor: activeCategory === "" ? "#FFF3EE" : "#fff", color: activeCategory === "" ? TERRA : "#666", fontWeight: activeCategory === "" ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}
          >
            All
          </button>
          {categories.map(([slug, count]) => (
            <button
              key={slug}
              onClick={() => { setActiveCategory(activeCategory === slug ? "" : slug); setExpanded(false); }}
              style={{ fontSize: "12px", padding: "4px 12px", borderRadius: "20px", border: `1px solid ${activeCategory === slug ? TERRA : "#E5E7EB"}`, backgroundColor: activeCategory === slug ? "#FFF3EE" : "#fff", color: activeCategory === slug ? TERRA : "#666", fontWeight: activeCategory === slug ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}
            >
              {categoryLabel(slug)} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Grid or empty */}
      {filtered.length === 0 ? (
        <div style={{ padding: "32px 24px", backgroundColor: "#FAFAFA", borderRadius: "12px", border: "1px dashed #E5E7EB", textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "#9CA3AF", margin: 0 }}>
            {hasActiveFilter ? "No picks match your filters." : "No picks yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="picks-browse-grid">
            {visible.map((spot) => (
              <CommunitySpotCard
                key={spot.id}
                spot={{
                  id: spot.id,
                  title: spot.name,
                  city: spot.city,
                  photoUrl: spot.photoUrl,
                  category: spot.category,
                  rating: spot.averageRating !== null ? Math.round(spot.averageRating) : null,
                  ratingCount: spot.ratingCount,
                  description: spot.description,
                  contributorName: spot.contributorName,
                }}
                href={spot.shareToken ? `/spots/${spot.shareToken}` : undefined}
              />
            ))}
          </div>
          {!expanded && hiddenCount > 0 && (
            <div style={{ textAlign: "center", marginTop: "24px" }}>
              <button
                onClick={() => setExpanded(true)}
                style={{ fontSize: "13px", color: TERRA, background: "none", border: `1px solid ${TERRA}`, borderRadius: "20px", padding: "8px 20px", cursor: "pointer", fontFamily: "inherit" }}
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
