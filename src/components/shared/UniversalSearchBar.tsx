"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  for (const c of (results.cities ?? [])) {
    flat.push({ key: `city-${c.id}`, url: `/cities/${c.slug}`, label: c.name, subtitle: c.countryName, photoUrl: c.photoUrl });
  }
  for (const c of (results.countries ?? [])) {
    flat.push({ key: `country-${c.id}`, url: `/countries/${c.slug}`, label: c.name, subtitle: c.continentName, photoUrl: c.photoUrl });
  }
  for (const c of (results.continents ?? [])) {
    flat.push({ key: `continent-${c.id}`, url: `/continents/${c.slug}`, label: c.name, subtitle: "Continent", photoUrl: null });
  }
  for (const p of (results.picks ?? [])) {
    const catLabel = CATEGORIES.find((cat) => cat.slug === p.category)?.label ?? p.category ?? "";
    flat.push({ key: `pick-${p.id}`, url: p.shareToken ? `/spots/${p.shareToken}` : "#", label: p.name, subtitle: [p.city, catLabel].filter(Boolean).join(" · "), photoUrl: p.photoUrl });
  }
  for (const t of (results.itineraries ?? [])) {
    flat.push({ key: `itin-${t.id}`, url: t.shareToken ? `/share/${t.shareToken}` : "#", label: t.title, subtitle: t.destinationCity ?? "", photoUrl: t.heroImageUrl });
  }
  for (const t of (results.tours ?? [])) {
    flat.push({ key: `tour-${t.id}`, url: t.shareToken ? `/s/${t.shareToken}` : "#", label: t.title, subtitle: t.destinationCity, photoUrl: t.photoUrl });
  }
  return flat;
}

function categoryLabel(slug: string | null | undefined): string {
  if (!slug) return "";
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

// ── Dropdown panel (shared between bar and overlay) ───────────────────────────

type DropdownProps = {
  query: string;
  results: SearchResults | null;
  recentSearches: string[];
  flatResults: FlatResult[];
  highlightIndex: number;
  onNavigate: (url: string, label: string) => void;
  onRecentSelect: (label: string) => void;
  containerStyle?: React.CSSProperties;
  // Dual-section scoped search support
  scopeName?: string;
  fallbackResults?: SearchResults | null;
  fallbackOffset?: number;
};

export function SearchDropdownPanel({
  query,
  results,
  recentSearches,
  flatResults,
  highlightIndex,
  onNavigate,
  onRecentSelect,
  containerStyle,
  scopeName,
  fallbackResults,
  fallbackOffset = 0,
}: DropdownProps) {
  const sections = buildSections(results);
  const fallbackSections = buildSections(fallbackResults ?? null);

  const hasScopedContent = sections.length > 0;
  const hasFallbackContent = fallbackSections.length > 0;
  const hasDualSection = !!scopeName && (hasScopedContent || hasFallbackContent);

  // Both empty and no recent searches — show "no results"
  if (query.length >= 1 && !hasScopedContent && !hasFallbackContent && recentSearches.length === 0) {
    return (
      <div style={{ padding: "20px 16px", fontSize: "13px", color: "#94A3B8", textAlign: "center", ...containerStyle }}>
        No results for &ldquo;{query}&rdquo;
      </div>
    );
  }

  let flatIdx = 0;
  let fbIdx = fallbackOffset;

  return (
    <div style={{ ...containerStyle }}>
      {/* Recent searches — shown when query is empty */}
      {query.length < 1 && recentSearches.length > 0 && (
        <div style={{ padding: "12px 0" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 16px 6px" }}>
            Recent searches
          </p>
          {recentSearches.map((s) => (
            <button
              key={s}
              onMouseDown={(e) => { e.preventDefault(); onRecentSelect(s); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 16px", fontSize: "13px", color: "#1B3A5C", background: "none", border: "none", cursor: "pointer" }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* "In {scopeName}" group heading — only when dual-section mode and scoped has results */}
      {hasDualSection && hasScopedContent && (
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#1B3A5C", textTransform: "uppercase", letterSpacing: "0.06em", padding: "10px 16px 2px" }}>
          In {scopeName}
        </p>
      )}

      {/* Scoped result sections */}
      {sections.map((section) => (
        <div key={section.heading} style={{ paddingBottom: "4px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", padding: "6px 16px 4px" }}>
            {section.heading}
          </p>
          {section.items.map((item) => {
            const idx = flatIdx++;
            return <ResultRow key={item.key} item={item} highlighted={highlightIndex === idx} onNavigate={onNavigate} />;
          })}
        </div>
      ))}

      {/* Fallback "Elsewhere" section */}
      {hasDualSection && hasFallbackContent && (
        <>
          <div style={{ margin: "6px 16px", borderTop: "1px solid #F1F5F9" }} />
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#1B3A5C", textTransform: "uppercase", letterSpacing: "0.06em", padding: "6px 16px 2px" }}>
            Elsewhere
          </p>
          {fallbackSections.map((section) => (
            <div key={`fb-${section.heading}`} style={{ paddingBottom: "4px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", padding: "6px 16px 4px" }}>
                {section.heading}
              </p>
              {section.items.map((item) => {
                const idx = fbIdx++;
                return <ResultRow key={`fb-${item.key}`} item={item} highlighted={highlightIndex === idx} onNavigate={onNavigate} />;
              })}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function buildSections(results: SearchResults | null): { heading: string; items: FlatResult[] }[] {
  if (!results) return [];
  const sections: { heading: string; items: FlatResult[] }[] = [];
  if ((results.cities ?? []).length > 0)
    sections.push({ heading: "Cities", items: (results.cities ?? []).map((c) => ({ key: `city-${c.id}`, url: `/cities/${c.slug}`, label: c.name, subtitle: c.countryName, photoUrl: c.photoUrl })) });
  if ((results.countries ?? []).length > 0)
    sections.push({ heading: "Countries", items: (results.countries ?? []).map((c) => ({ key: `country-${c.id}`, url: `/countries/${c.slug}`, label: c.name, subtitle: c.continentName, photoUrl: c.photoUrl })) });
  if ((results.continents ?? []).length > 0)
    sections.push({ heading: "Continents", items: (results.continents ?? []).map((c) => ({ key: `continent-${c.id}`, url: `/continents/${c.slug}`, label: c.name, subtitle: "Continent", photoUrl: null })) });
  if ((results.picks ?? []).length > 0)
    sections.push({ heading: "Picks", items: (results.picks ?? []).map((p) => ({ key: `pick-${p.id}`, url: p.shareToken ? `/spots/${p.shareToken}` : "#", label: p.name, subtitle: [p.city, categoryLabel(p.category)].filter(Boolean).join(" · "), photoUrl: p.photoUrl })) });
  if ((results.itineraries ?? []).length > 0)
    sections.push({ heading: "Itineraries", items: (results.itineraries ?? []).map((t) => ({ key: `itin-${t.id}`, url: t.shareToken ? `/share/${t.shareToken}` : "#", label: t.title, subtitle: t.destinationCity ?? "", photoUrl: t.heroImageUrl })) });
  if ((results.tours ?? []).length > 0)
    sections.push({ heading: "Tours", items: (results.tours ?? []).map((t) => ({ key: `tour-${t.id}`, url: t.shareToken ? `/s/${t.shareToken}` : "#", label: t.title, subtitle: t.destinationCity, photoUrl: t.photoUrl })) });
  return sections;
}

function ResultRow({ item, highlighted, onNavigate }: { item: FlatResult; highlighted: boolean; onNavigate: (url: string, label: string) => void }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onNavigate(item.url, item.label); }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        textAlign: "left",
        padding: "7px 16px",
        background: highlighted ? "#F8FAFC" : "none",
        border: "none",
        cursor: "pointer",
        transition: "background 0.1s",
      }}
    >
      {item.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.photoUrl} alt="" style={{ width: "32px", height: "32px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <div style={{ width: "32px", height: "32px", borderRadius: "6px", backgroundColor: "#E2E8F0", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "#94A3B8" }}>
          {item.label.charAt(0)}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#1B3A5C", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.label}
        </p>
        {item.subtitle && (
          <p style={{ margin: 0, fontSize: "11px", color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.subtitle}
          </p>
        )}
      </div>
    </button>
  );
}

// ── Desktop search bar ────────────────────────────────────────────────────────

export function UniversalSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("flokk_recent_searches");
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
  }, []);

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
    if (query.length < 1) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/universal?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          setResults(await res.json());
          setIsOpen(true);
          setHighlightIndex(-1);
        }
      } catch {}
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const flatResults = buildFlatResults(results);

  function navigate(url: string, label: string) {
    setRecentSearches((prev) => {
      const next = [label, ...prev.filter((s) => s !== label)].slice(0, 5);
      try { localStorage.setItem("flokk_recent_searches", JSON.stringify(next)); } catch {}
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

  const showDropdown = isOpen && (query.length >= 1 ? !!results : recentSearches.length > 0);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          border: "1px solid #E2E8F0",
          borderRadius: "999px",
          padding: "0 14px",
          height: "36px",
          width: isFocused ? "360px" : "240px",
          transition: "width 0.2s ease",
          backgroundColor: "#F8FAFC",
        }}
      >
        <Search size={14} style={{ color: "#94A3B8", flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="search"
          name="flokk-search-universal"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { setIsFocused(true); setIsOpen(true); }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={onKeyDown}
          placeholder="Search anywhere…"
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
            minWidth: "360px",
            backgroundColor: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: "14px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            maxHeight: "500px",
            overflowY: "auto",
            zIndex: 200,
          }}
        >
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
      )}
    </div>
  );
}
