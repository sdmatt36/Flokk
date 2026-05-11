"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { SearchDropdownPanel } from "./UniversalSearchBar";
import { QuickAddModal } from "./QuickAddModal";
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

  for (const c of (results.cities ?? []))
    flat.push({ key: `city-${c.id}`, url: `/cities/${c.slug}`, label: c.name, subtitle: c.countryName, photoUrl: c.photoUrl });
  for (const c of (results.countries ?? []))
    flat.push({ key: `country-${c.id}`, url: `/countries/${c.slug}`, label: c.name, subtitle: c.continentName, photoUrl: c.photoUrl });
  for (const c of (results.continents ?? []))
    flat.push({ key: `continent-${c.id}`, url: `/continents/${c.slug}`, label: c.name, subtitle: "Continent", photoUrl: null });
  for (const p of (results.picks ?? []))
    flat.push({ key: `pick-${p.id}`, url: p.shareToken ? `/spots/${p.shareToken}` : "#", label: p.name, subtitle: [p.city, catLabel(p.category)].filter(Boolean).join(" · "), photoUrl: p.photoUrl });
  for (const t of (results.itineraries ?? []))
    flat.push({ key: `itin-${t.id}`, url: t.shareToken ? `/share/${t.shareToken}` : "#", label: t.title, subtitle: t.destinationCity ?? "", photoUrl: t.heroImageUrl });
  for (const t of (results.tours ?? []))
    flat.push({ key: `tour-${t.id}`, url: t.shareToken ? `/s/${t.shareToken}` : "#", label: t.title, subtitle: t.destinationCity, photoUrl: t.photoUrl });
  return flat;
}

interface Props {
  scope: "continent" | "country" | "city";
  scopeId: string;
  scopeName: string;
  placeholder?: string;
}

export function ScopedSearchBar({ scope, scopeId, scopeName, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [fallback, setFallback] = useState<SearchResults | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [showPickModal, setShowPickModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const storageKey = `flokk_recent_${scope}_${scopeId}`;
  const effectivePlaceholder = placeholder ?? "Search The Flokkin Planet";

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 1) { setResults(null); setFallback(null); return; }
    setResults(null);
    setFallback(null);
    const params = new URLSearchParams({
      q: query,
      scope,
      scopeId,
      scopeName,
      includeFallback: "true",
    });
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/universal?${params}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setFallback(data.fallback ?? null);
          setIsOpen(true);
          setHighlightIndex(-1);
        }
      } catch {}
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, scope, scopeId, scopeName]);

  const flatResults = buildFlatResults(results);
  const flatFallback = buildFlatResults(fallback);
  const allFlat = [...flatResults, ...flatFallback];

  function navigate(url: string, label: string) {
    setRecentSearches((prev) => {
      const next = [label, ...prev.filter((s) => s !== label)].slice(0, 5);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
    setIsOpen(false);
    setQuery("");
    router.push(url);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setIsOpen(false); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, allFlat.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && highlightIndex >= 0 && allFlat[highlightIndex]) {
      navigate(allFlat[highlightIndex].url, allFlat[highlightIndex].label);
    }
  }

  const showDropdown = isOpen && (query.length >= 1 ? (!!results || !!fallback) : recentSearches.length > 0);

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1, maxWidth: "480px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          border: "1px solid #E2E8F0",
          borderRadius: "999px",
          padding: "0 14px",
          height: "38px",
          backgroundColor: isFocused ? "#fff" : "#F8FAFC",
          transition: "background 0.15s",
        }}
      >
        <Search size={14} style={{ color: "#94A3B8", flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="search"
          name="flokk-search-scoped"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { setIsFocused(true); setIsOpen(true); }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={onKeyDown}
          placeholder={effectivePlaceholder}
          style={{
            border: "none",
            outline: "none",
            fontSize: "13px",
            color: "#1B3A5C",
            background: "transparent",
            width: "100%",
          }}
        />
      </div>

      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            minWidth: "320px",
            backgroundColor: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: "14px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            maxHeight: "480px",
            overflowY: "auto",
            zIndex: 200,
          }}
        >
          <SearchDropdownPanel
            query={query}
            results={results}
            recentSearches={recentSearches}
            flatResults={allFlat}
            highlightIndex={highlightIndex}
            onNavigate={navigate}
            onRecentSelect={(label) => { setQuery(label); inputRef.current?.focus(); }}
            onAddPick={() => { setIsOpen(false); setShowPickModal(true); }}
            scopeName={scopeName}
            fallbackResults={fallback}
            fallbackOffset={flatResults.length}
          />
        </div>
      )}

      <QuickAddModal
        isOpen={showPickModal}
        defaultTab="pick"
        prefillName={query}
        prefillCity={scope === "city" ? scopeName : ""}
        onClose={() => setShowPickModal(false)}
      />
    </div>
  );
}
