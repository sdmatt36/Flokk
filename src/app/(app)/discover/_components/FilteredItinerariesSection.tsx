"use client";

import { useState, useMemo } from "react";
import { Playfair_Display } from "next/font/google";
import { CommunityTripCard } from "@/components/shared/cards/CommunityTripCard";
import type { CommunityTripCardTrip } from "@/components/shared/cards/CommunityTripCard";
import { QuickAddModal } from "@/components/shared/QuickAddModal";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"], display: "swap" });

const TERRA = "#C4664A";
const NAVY = "#1B3A5C";

const GRID_CSS = `
  .filtered-itin-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  @media (max-width: 900px) {
    .filtered-itin-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 500px) {
    .filtered-itin-grid { grid-template-columns: 1fr; }
  }
`;

interface Props {
  trips: CommunityTripCardTrip[];
  id?: string;
  title?: string;
  description?: string;
  emptyText?: string;
  browseAllHref?: string;
  browseAllLabel?: string;
}

export function FilteredItinerariesSection({
  trips,
  id,
  title = "Itineraries",
  description,
  emptyText = "No itineraries yet.",
  browseAllHref,
  browseAllLabel = "Browse all itineraries",
}: Props) {
  const [search, setSearch] = useState("");
  const [activeCountry, setActiveCountry] = useState("");
  const [activeCity, setActiveCity] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const countries = useMemo(() => {
    const seen = new Set<string>();
    return trips
      .map((t) => t.destinationCountry)
      .filter((c): c is string => !!c && !seen.has(c) && !!seen.add(c))
      .sort();
  }, [trips]);

  const cities = useMemo(() => {
    const seen = new Set<string>();
    return trips
      .filter((t) => !activeCountry || t.destinationCountry === activeCountry)
      .map((t) => t.destinationCity)
      .filter((c): c is string => !!c && !seen.has(c) && !!seen.add(c))
      .sort();
  }, [trips, activeCountry]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return trips.filter((t) => {
      if (
        q &&
        !`${t.title} ${t.destinationCity ?? ""} ${t.destinationCountry ?? ""}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      if (activeCountry && t.destinationCountry !== activeCountry) return false;
      if (activeCity && t.destinationCity !== activeCity) return false;
      return true;
    });
  }, [trips, search, activeCountry, activeCity]);

  const LIMIT = 9;
  const visible = expanded ? filtered : filtered.slice(0, LIMIT);
  const hiddenCount = filtered.length - LIMIT;

  function resetFilters() {
    setSearch("");
    setActiveCountry("");
    setActiveCity("");
    setExpanded(false);
  }

  const hasActiveFilter = search || activeCountry || activeCity;

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
          {trips.length > 0 && (
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
              {trips.length}
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
          + Itinerary
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
      {trips.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "16px",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            placeholder="Search itineraries..."
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
            {hasActiveFilter ? "No itineraries match your filters." : emptyText}
          </p>
        </div>
      ) : (
        <>
          <div className="filtered-itin-grid">
            {visible.map((trip) => (
              <CommunityTripCard key={trip.id} trip={trip} />
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

      <QuickAddModal
        isOpen={modalOpen}
        defaultTab="itinerary"
        onClose={() => setModalOpen(false)}
      />
    </section>
  );
}
