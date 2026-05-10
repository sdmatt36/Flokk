"use client";

import { useState, useMemo } from "react";
import { Playfair_Display } from "next/font/google";
import { PicksGrid } from "./PicksGrid";
import type { PickSpot } from "./PicksGrid";
import { QuickAddModal } from "@/components/shared/QuickAddModal";
import { CATEGORIES } from "@/lib/categories";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"], display: "swap" });

const TERRA = "#C4664A";
const NAVY = "#1B3A5C";

interface Props {
  spots: PickSpot[];
  id?: string;
  title?: string;
  description?: string;
  emptyText?: string;
  browseAllHref?: string;
  browseAllLabel?: string;
}

function categoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug.replace(/_/g, " ");
}

export function FilteredPicksSection({
  spots,
  id,
  title = "Picks",
  description,
  emptyText = "No picks yet.",
  browseAllHref,
  browseAllLabel = "Browse all picks",
}: Props) {
  const [search, setSearch] = useState("");
  const [activeCountry, setActiveCountry] = useState("");
  const [activeCity, setActiveCity] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const countries = useMemo(() => {
    const seen = new Set<string>();
    return spots
      .map((s) => s.country)
      .filter((c): c is string => !!c && !seen.has(c) && !!seen.add(c))
      .sort();
  }, [spots]);

  const cities = useMemo(() => {
    const seen = new Set<string>();
    return spots
      .filter((s) => !activeCountry || s.country === activeCountry)
      .map((s) => s.city)
      .filter((c): c is string => !!c && !seen.has(c) && !!seen.add(c))
      .sort();
  }, [spots, activeCountry]);

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
      if (activeCity && s.city !== activeCity) return false;
      if (activeCategory && s.category !== activeCategory) return false;
      return true;
    });
  }, [spots, search, activeCountry, activeCity, activeCategory]);

  const LIMIT = 9;
  const visible = expanded ? filtered : filtered.slice(0, LIMIT);
  const hiddenCount = filtered.length - LIMIT;

  function resetFilters() {
    setSearch("");
    setActiveCountry("");
    setActiveCity("");
    setActiveCategory("");
    setExpanded(false);
  }

  const hasActiveFilter = search || activeCountry || activeCity || activeCategory;

  return (
    <section
      id={id}
      style={{ paddingTop: "48px", paddingBottom: "8px", scrollMarginTop: "108px" }}
    >
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

      {description && (
        <p
          style={{
            fontSize: "13px",
            color: "#888",
            fontStyle: "italic",
            marginBottom: "16px",
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}

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
            {countries.length > 1 && (
              <select
                value={activeCountry}
                onChange={(e) => {
                  setActiveCountry(e.target.value);
                  setActiveCity("");
                  setExpanded(false);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                  fontSize: "13px",
                  color: activeCountry ? "#1a1a1a" : "#888",
                  background: "#fff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <option value="">All countries</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
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
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
              <button
                onClick={() => {
                  setActiveCategory("");
                  setExpanded(false);
                }}
                style={{
                  fontSize: "12px",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  border: `1px solid ${activeCategory === "" ? TERRA : "#E5E7EB"}`,
                  backgroundColor: activeCategory === "" ? "#FFF3EE" : "#fff",
                  color: activeCategory === "" ? TERRA : "#666",
                  fontWeight: activeCategory === "" ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                All
              </button>
              {categories.map(([slug, count]) => (
                <button
                  key={slug}
                  onClick={() => {
                    setActiveCategory(activeCategory === slug ? "" : slug);
                    setExpanded(false);
                  }}
                  style={{
                    fontSize: "12px",
                    padding: "4px 12px",
                    borderRadius: "20px",
                    border: `1px solid ${activeCategory === slug ? TERRA : "#E5E7EB"}`,
                    backgroundColor: activeCategory === slug ? "#FFF3EE" : "#fff",
                    color: activeCategory === slug ? TERRA : "#666",
                    fontWeight: activeCategory === slug ? 600 : 400,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {categoryLabel(slug)} ({count})
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Grid or empty state */}
      {filtered.length === 0 ? (
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
            {hasActiveFilter ? "No picks match your filters." : emptyText}
          </p>
        </div>
      ) : (
        <>
          <PicksGrid spots={visible} />
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

      {browseAllHref && filtered.length > 0 && (
        <div style={{ textAlign: "right", marginTop: "16px" }}>
          <a
            href={browseAllHref}
            style={{ fontSize: "13px", color: TERRA, textDecoration: "none", fontWeight: 600 }}
          >
            {browseAllLabel} →
          </a>
        </div>
      )}

      <QuickAddModal isOpen={modalOpen} defaultTab="pick" onClose={() => setModalOpen(false)} />
    </section>
  );
}
