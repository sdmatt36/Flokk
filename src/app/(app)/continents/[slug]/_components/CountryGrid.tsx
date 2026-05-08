"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { CountryCard } from "./CountryCard";

type Country = {
  slug: string;
  name: string;
  _count: { cities: number };
  spotCount: number;
  topCities: Array<{ name: string; photoUrl: string | null }>;
};

type Props = {
  countries: Country[];
  continentColor: string;
  continentLabel: string;
  playfairClassName: string;
};

export function CountryGrid({ countries, continentColor, continentLabel, playfairClassName }: Props) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? countries.filter((c) => c.name.toLowerCase().includes(query.toLowerCase().trim()))
    : countries;

  return (
    <div>
      <h2 className={`${playfairClassName} text-2xl md:text-3xl text-[#1B3A5C] mb-6`}>
        Browse {countries.length} countries
      </h2>

      {/* Search input — matches TripsPageClient.tsx:620-645 style */}
      <div className="relative mb-8">
        <div
          className="absolute inset-y-0 left-4 flex items-center"
          style={{ pointerEvents: "none" }}
        >
          <Search size={16} style={{ color: "#717171" }} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search countries"
          style={{
            width: "100%",
            paddingLeft: "44px",
            paddingRight: "16px",
            paddingTop: "14px",
            paddingBottom: "14px",
            borderRadius: "16px",
            border: "1.5px solid #EEEEEE",
            backgroundColor: "#fff",
            fontSize: "14px",
            color: "#1B3A5C",
            outline: "none",
            boxSizing: "border-box",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#C4664A"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#EEEEEE"; }}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center italic text-slate-600 py-12">
          No countries match &ldquo;{query}&rdquo;
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((country) => (
            <CountryCard
              key={country.slug}
              country={country}
              continentColor={continentColor}
              continentLabel={continentLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
