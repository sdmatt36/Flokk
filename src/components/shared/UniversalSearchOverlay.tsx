"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Search } from "lucide-react";
import { SearchDropdownPanel } from "./UniversalSearchBar";
import { CATEGORIES } from "@/lib/categories";

type SearchResults = {
  cities: { id: string; slug: string; name: string; countryName: string; continentSlug: string; photoUrl: string | null }[];
  countries: { id: string; slug: string; name: string; continentName: string; continentSlug: string; photoUrl: string | null }[];
  continents: { id: string; slug: string; name: string }[];
  picks: { id: string; name: string; city: string; country: string | null; category: string | null; photoUrl: string | null; shareToken: string | null }[];
  itineraries: { id: string; title: string; shareToken: string | null; destinationCity: string | null; heroImageUrl: string | null }[];
  tours: { id: string; title: string; shareToken: string | null; destinationCity: string; photoUrl: string | null }[];
};

type FlatResult = { key: string; url: string; label: string; subtitle: string; photoUrl: string | null };

function buildFlatResults(results: SearchResults | null): FlatResult[] {
  if (!results) return [];
  const flat: FlatResult[] = [];
  const catLabel = (slug: string | null | undefined) =>
    CATEGORIES.find((c) => c.slug === slug)?.label ?? slug ?? "";

  for (const c of results.cities)
    flat.push({ key: `city-${c.id}`, url: `/cities/${c.slug}`, label: c.name, subtitle: c.countryName, photoUrl: c.photoUrl });
  for (const c of results.countries)
    flat.push({ key: `country-${c.id}`, url: `/countries/${c.slug}`, label: c.name, subtitle: c.continentName, photoUrl: c.photoUrl });
  for (const c of results.continents)
    flat.push({ key: `continent-${c.id}`, url: `/continents/${c.slug}`, label: c.name, subtitle: "Continent", photoUrl: null });
  for (const p of results.picks)
    flat.push({ key: `pick-${p.id}`, url: p.shareToken ? `/spots/${p.shareToken}` : "#", label: p.name, subtitle: [p.city, catLabel(p.category)].filter(Boolean).join(" · "), photoUrl: p.photoUrl });
  for (const t of results.itineraries)
    flat.push({ key: `itin-${t.id}`, url: t.shareToken ? `/share/${t.shareToken}` : "#", label: t.title, subtitle: t.destinationCity ?? "", photoUrl: t.heroImageUrl });
  for (const t of results.tours)
    flat.push({ key: `tour-${t.id}`, url: t.shareToken ? `/s/${t.shareToken}` : "#", label: t.title, subtitle: t.destinationCity, photoUrl: t.photoUrl });
  return flat;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function UniversalSearchOverlay({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      try {
        const stored = localStorage.getItem("flokk_recent_searches");
        if (stored) setRecentSearches(JSON.parse(stored));
      } catch {}
    } else {
      setQuery("");
      setResults(null);
      setHighlightIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults(null); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/universal?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          setResults(await res.json());
          setHighlightIndex(-1);
        }
      } catch {}
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const flatResults = buildFlatResults(results);

  function navigate(url: string, label: string) {
    setRecentSearches((prev) => {
      const next = [label, ...prev.filter((s) => s !== label)].slice(0, 5);
      try { localStorage.setItem("flokk_recent_searches", JSON.stringify(next)); } catch {}
      return next;
    });
    onClose();
    router.push(url);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, flatResults.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && highlightIndex >= 0 && flatResults[highlightIndex]) {
      navigate(flatResults[highlightIndex].url, flatResults[highlightIndex].label);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#fff",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 16px",
          borderBottom: "1px solid #EEEEEE",
          flexShrink: 0,
        }}
      >
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex", alignItems: "center", padding: "4px" }}
          aria-label="Close search"
        >
          <X size={22} />
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flex: 1,
            border: "1px solid #E2E8F0",
            borderRadius: "999px",
            padding: "0 14px",
            height: "40px",
            backgroundColor: "#F8FAFC",
          }}
        >
          <Search size={16} style={{ color: "#94A3B8", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search anywhere…"
            style={{
              border: "none",
              outline: "none",
              fontSize: "15px",
              color: "#1B3A5C",
              background: "transparent",
              width: "100%",
            }}
          />
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <SearchDropdownPanel
          query={query}
          results={results}
          recentSearches={recentSearches}
          flatResults={flatResults}
          highlightIndex={highlightIndex}
          onNavigate={navigate}
          onRecentSelect={(label) => { setQuery(label); inputRef.current?.focus(); }}
        />
      </div>
    </div>
  );
}
