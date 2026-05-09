"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "cities", label: "Cities" },
  { id: "itineraries", label: "Itineraries" },
  { id: "picks", label: "Picks" },
  { id: "tours", label: "Tours" },
];

export function CountrySectionNav() {
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
        overflowX: "auto",
      }}
    >
      <div
        style={{
          maxWidth: "1080px",
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          gap: "4px",
          alignItems: "center",
          height: "48px",
        }}
      >
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() =>
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
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
