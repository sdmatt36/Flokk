"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const SECTIONS = [
  { id: "itineraries", label: "Itineraries" },
  { id: "tours", label: "Tours" },
  { id: "food", label: "Food & Drink" },
  { id: "activities", label: "Activities" },
  { id: "lodging", label: "Lodging" },
];

interface Props {
  cityName: string;
  countryName: string;
  countrySlug: string;
  continentName: string;
  continentSlug: string;
}

export function SectionNav({ cityName, countryName, countrySlug, continentName, continentSlug }: Props) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      style={{
        position: "sticky",
        top: "60px",
        zIndex: 50,
        backgroundColor: "#fff",
        borderBottom: "1px solid #EEEEEE",
      }}
    >
      {/* Breadcrumb row */}
      <div
        style={{
          maxWidth: "1080px",
          margin: "0 auto",
          padding: "6px 24px 0",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "11px",
          color: "#AAAAAA",
          flexWrap: "wrap",
        }}
      >
        <Link href="/continents" style={{ color: "#AAAAAA", textDecoration: "none" }}>
          Destinations
        </Link>
        <span>›</span>
        <Link
          href={`/continents/${continentSlug}`}
          style={{ color: "#AAAAAA", textDecoration: "none" }}
        >
          {continentName}
        </Link>
        <span>›</span>
        <Link
          href={`/countries/${countrySlug}`}
          style={{ color: "#AAAAAA", textDecoration: "none" }}
        >
          {countryName}
        </Link>
        <span>›</span>
        <span style={{ color: "#1B3A5C", fontWeight: 600 }}>{cityName}</span>
      </div>

      {/* Section pills */}
      <div
        style={{
          maxWidth: "1080px",
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          gap: "4px",
          alignItems: "center",
          height: "44px",
          overflowX: "auto",
        }}
      >
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => {
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            style={{
              flexShrink: 0,
              fontSize: "13px",
              fontWeight: active === id ? 700 : 500,
              color: active === id ? "#C4664A" : "#555",
              backgroundColor: active === id ? "#FFF3EE" : "transparent",
              border: active === id ? "1px solid #C4664A" : "1px solid transparent",
              borderRadius: "20px",
              padding: "6px 14px",
              cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
