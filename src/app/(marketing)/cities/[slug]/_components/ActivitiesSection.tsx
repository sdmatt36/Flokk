"use client";

import { useState } from "react";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import { SpotCard, type CompactSpotCardProps } from "./cards";
import { CATEGORIES } from "@/lib/categories";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"] });

interface ActivitiesSectionProps {
  spots: CompactSpotCardProps[];
  cityName: string;
  addHref?: string;
}

export function ActivitiesSection({ spots, cityName, addHref = "/discover/spots" }: ActivitiesSectionProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Build available category pills from actual spot data
  const presentCategories = [...new Set(spots.map((s) => s.category).filter(Boolean))] as string[];

  const filtered = activeCategory
    ? spots.filter((s) => s.category === activeCategory)
    : spots;

  const categoryLabel = (slug: string) =>
    CATEGORIES.find((c) => c.slug === slug)?.label ?? slug.replace(/_/g, " ");

  return (
    <section id="activities" style={{ paddingTop: "48px", paddingBottom: "8px", scrollMarginTop: "108px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
          <h2
            className={playfair.className}
            style={{ fontSize: "22px", fontWeight: 700, color: "#1B3A5C", margin: 0 }}
          >
            Activities
          </h2>
          {spots.length > 0 && (
            <span style={{
              fontSize: "12px", fontWeight: 600, color: "#C4664A",
              backgroundColor: "#FFF3EE", borderRadius: "20px",
              padding: "2px 10px",
            }}>
              {spots.length}
            </span>
          )}
        </div>
        <Link href={addHref} style={{ fontSize: "13px", color: "#888", textDecoration: "none", flexShrink: 0 }}>
          Add →
        </Link>
      </div>

      {spots.length === 0 ? (
        <div style={{
          padding: "32px 24px", backgroundColor: "#FAFAFA",
          borderRadius: "12px", border: "1px dashed #E5E7EB",
          textAlign: "center",
        }}>
          <p style={{ fontSize: "14px", color: "#9CA3AF", margin: 0 }}>
            No activities yet. Help us build {cityName}.
          </p>
        </div>
      ) : (
        <>
          {/* Category filter pills */}
          {presentCategories.length > 1 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
              <button
                onClick={() => setActiveCategory(null)}
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
                  onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  style={{
                    fontSize: "12px", padding: "4px 12px", borderRadius: "20px",
                    border: `1px solid ${activeCategory === cat ? "#C4664A" : "#E5E7EB"}`,
                    backgroundColor: activeCategory === cat ? "#FFF3EE" : "#fff",
                    color: activeCategory === cat ? "#C4664A" : "#666",
                    fontWeight: activeCategory === cat ? 600 : 400,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {categoryLabel(cat)}
                </button>
              ))}
            </div>
          )}

          {/* Horizontal scroll row */}
          <div style={{
            display: "flex", overflowX: "auto",
            gap: "12px", paddingBottom: "16px",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
          }}>
            {filtered.map((spot) => (
              <div key={spot.id} style={{ scrollSnapAlign: "start" }}>
                <SpotCard spot={spot} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
