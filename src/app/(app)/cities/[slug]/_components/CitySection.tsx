"use client";

import { useState } from "react";
import React from "react";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"] });

const GRID_CSS = `
  .city-section-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  @media (max-width: 900px) {
    .city-section-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 500px) {
    .city-section-grid { grid-template-columns: 1fr; }
  }
`;

interface CitySectionProps {
  id: string;
  title: string;
  count: number;
  seeAllHref?: string;
  addHref?: string;
  addLabel?: string;
  emptyText: string;
  children: React.ReactNode;
  isEmpty: boolean;
}

export function CitySection({
  id,
  title,
  count,
  seeAllHref,
  addHref = "/discover/spots",
  addLabel = "Add →",
  emptyText,
  children,
  isEmpty,
}: CitySectionProps) {
  const [expanded, setExpanded] = useState(false);
  const childArray = React.Children.toArray(children);
  const visible = expanded ? childArray : childArray.slice(0, 8);
  const hiddenCount = childArray.length - 8;

  return (
    <section id={id} style={{ paddingTop: "48px", paddingBottom: "8px", scrollMarginTop: "108px" }}>
      <style>{GRID_CSS}</style>

      {/* Section header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "16px", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
          <h2
            className={playfair.className}
            style={{ fontSize: "22px", fontWeight: 700, color: "#1B3A5C", margin: 0 }}
          >
            {title}
          </h2>
          {count > 0 && (
            <span style={{
              fontSize: "12px", fontWeight: 600, color: "#C4664A",
              backgroundColor: "#FFF3EE", borderRadius: "20px",
              padding: "2px 10px",
            }}>
              {count}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexShrink: 0 }}>
          {seeAllHref && count > 0 && (
            <Link href={seeAllHref} style={{ fontSize: "13px", color: "#C4664A", textDecoration: "none", fontWeight: 600 }}>
              See all →
            </Link>
          )}
          {addHref && (
            <Link href={addHref} style={{ fontSize: "13px", color: "#888", textDecoration: "none" }}>
              {addLabel}
            </Link>
          )}
        </div>
      </div>

      {/* Content */}
      {isEmpty ? (
        <div style={{
          padding: "32px 24px", backgroundColor: "#FAFAFA",
          borderRadius: "12px", border: "1px dashed #E5E7EB",
          textAlign: "center",
        }}>
          <p style={{ fontSize: "14px", color: "#9CA3AF", margin: 0 }}>{emptyText}</p>
        </div>
      ) : (
        <>
          <div className="city-section-grid">
            {visible}
          </div>
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
