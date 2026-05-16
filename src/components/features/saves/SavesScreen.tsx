"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SaveDetailModal } from "@/components/features/saves/SaveDetailModal";
import { CATEGORIES, categoryLabel, normalizeCategorySlug } from "@/lib/categories";
import { CategoryFilterChips } from "@/components/shared/CategoryFilterChips";
import {
  Search,
  MapPin,
  Plus,
  X,
} from "lucide-react";
import { TourActionMenu } from "@/components/tours/TourActionMenu";
import { haversineKm, WITHIN_REACH_KM } from "@/lib/geo";
import { CountryCityCard } from "@/app/(app)/countries/[slug]/_components/CountryCityCard";
import { SaveCard, mapApiItem, SOURCE_LABEL_MAP, resolveTitle } from "@/components/features/saves/SaveCard";
import type { Save, ApiItem } from "@/components/features/saves/SaveCard";
import { SavesCardGrid } from "@/components/features/saves/SavesCardGrid";
import { RatingModal } from "@/components/features/saves/RatingModal";
import { ImportMapsModal } from "@/components/features/saves/ImportMapsModal";

// ─── Data ────────────────────────────────────────────────────────────────────

type PlaceResult = {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry?: { location: { lat: number; lng: number } };
  photos?: { photo_reference: string }[];
};


// ─── Tabbed saves types ───────────────────────────────────────────────────────

type TripRow = {
  id: string;
  title: string;
  destinationCity: string | null;
  cities: string[];
  country: string | null;
  countries: string[];
  startDate: string | null;
  endDate: string | null;
};

interface UpcomingTripSection {
  tripId: string;
  tripName: string;
  destinationCity: string | null;
  cities: string[];
  startDate: string | null;
  endDate: string | null;
  explicitSaves: Save[];
  suggestedSaves: Save[];
}

interface PastCitySection {
  city: string;
  saves: Save[];
}

interface TabbedSavesState {
  upcoming: UpcomingTripSection[];
  past: PastCitySection[];
  unassigned: Save[];
  imported: Save[];
  counts: { upcoming: number; past: number; unassigned: number; imported: number };
  suggestedTripMap: Map<string, Array<{ id: string; name: string }>>;
}

const IMPORT_SOURCE_METHODS = new Set(["maps_import"]);

type SharedCardGridProps = {
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  assignTrip: (id: string, trip: string) => void;
  onCardClick: (id: string) => void;
  availableTrips: { id: string; title: string; endDate?: string | null }[];
  onDeleted?: (id: string) => void;
  onIdentifyPlace?: (id: string) => void;
  onRateClick?: (id: string, title: string) => void;
  ratedItemId?: string | null;
  onShareToast?: (message: string) => void;
};

function formatTripDateRange(startIso: string, endIso: string | null): string {
  const start = new Date(startIso);
  const monthFmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (!endIso) return start.toLocaleDateString("en-US", monthFmt);
  const end = new Date(endIso);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${end.getDate()}`;
  }
  return `${start.toLocaleDateString("en-US", monthFmt)} – ${end.toLocaleDateString("en-US", monthFmt)}`;
}

function groupTabbedSaves(
  saves: Save[],
  allTrips: TripRow[],
  tripCityCoords: Record<string, { lat: number; lng: number }>
): TabbedSavesState {
  const now = new Date();

  const upcomingTrips = allTrips
    .filter((t) => !t.endDate || new Date(t.endDate) >= now)
    .sort((a, b) => {
      const aStart = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const bStart = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      if (aStart !== bStart) return aStart - bStart;
      return (a.title ?? "").localeCompare(b.title ?? "");
    });

  const pastTrips = allTrips.filter((t) => t.endDate && new Date(t.endDate) < now);
  const pastTripIds = new Set(pastTrips.map((t) => t.id));

  // Build past city set
  const pastTripCities = new Set<string>();
  for (const t of pastTrips) {
    const cityList = t.cities.length > 0 ? t.cities : (t.destinationCity ? [t.destinationCity] : []);
    for (const c of cityList) {
      const key = c.trim().toLowerCase();
      if (key) pastTripCities.add(key);
    }
  }

  // Build past country set
  const pastTripCountries = new Set<string>();
  for (const t of pastTrips) {
    const tripCountries = t.countries.length > 0 ? t.countries : (t.country ? [t.country] : []);
    for (const c of tripCountries) {
      const key = c.trim().toLowerCase();
      if (key) pastTripCountries.add(key);
    }
  }

  // Build upcoming indexes
  // city key → [tripId, ...]
  const upcomingCityIndex = new Map<string, string[]>();
  // tripId → its city keys (for Tier 2 geo check)
  const upcomingTripCities = new Map<string, string[]>();
  // tripId → its country keys (for Tier 3)
  const upcomingTripCountries = new Map<string, string[]>();
  // tripId → primary country string (for Tier 3 key lookup)
  const upcomingTripPrimaryCountry = new Map<string, string>();

  for (const t of upcomingTrips) {
    const cityList = t.cities.length > 0 ? t.cities : (t.destinationCity ? [t.destinationCity] : []);
    const cityKeys = cityList.map((c) => c.trim().toLowerCase()).filter(Boolean);
    upcomingTripCities.set(t.id, cityKeys);
    for (const key of cityKeys) {
      const existing = upcomingCityIndex.get(key) ?? [];
      existing.push(t.id);
      upcomingCityIndex.set(key, existing);
    }

    const tripCountries = t.countries.length > 0 ? t.countries : (t.country ? [t.country] : []);
    const countryKeys = tripCountries.map((c) => c.trim().toLowerCase()).filter(Boolean);
    upcomingTripCountries.set(t.id, countryKeys);
    if (tripCountries.length > 0) {
      upcomingTripPrimaryCountry.set(t.id, tripCountries[0]);
    }
  }

  const upcomingSections: UpcomingTripSection[] = upcomingTrips.map((t) => ({
    tripId: t.id,
    tripName: t.title,
    destinationCity: t.destinationCity,
    cities: t.cities,
    startDate: t.startDate,
    endDate: t.endDate,
    explicitSaves: [],
    suggestedSaves: [],
  }));
  const upcomingTripIndex = new Map(upcomingSections.map((s) => [s.tripId, s]));

  const pastCityMap = new Map<string, Save[]>();
  const unassigned: Save[] = [];
  const imported: Save[] = [];
  const suggestedTripMap = new Map<string, Array<{ id: string; name: string }>>();

  for (const save of saves) {
    const cityKey = (save.destinationCity ?? "").trim().toLowerCase();
    const countryKey = (save.destinationCountry ?? "").trim().toLowerCase();

    // Maps imports go directly to Imported tab — bypass all trip routing
    if (!save.tripId && IMPORT_SOURCE_METHODS.has(save.sourceMethod ?? "")) {
      imported.push(save);
      continue;
    }

    // Explicit assignment to an upcoming trip
    if (save.tripId && upcomingTripIndex.has(save.tripId)) {
      upcomingTripIndex.get(save.tripId)!.explicitSaves.push(save);
      continue;
    }

    // Assigned to a past trip
    if (save.tripId && pastTripIds.has(save.tripId)) {
      const city = save.destinationCity ?? "Unknown";
      const list = pastCityMap.get(city) ?? [];
      list.push(save);
      pastCityMap.set(city, list);
      continue;
    }

    if (!save.tripId) {
      const tier1TripIds = new Set<string>();
      const tier2TripIds = new Set<string>();

      // ── TIER 1: exact city match ──────────────────────────────────────────
      if (cityKey) {
        const matches = upcomingCityIndex.get(cityKey) ?? [];
        for (const tripId of matches) {
          const tagged: Save = { ...save, suggestionTier: "primary" };
          upcomingTripIndex.get(tripId)!.suggestedSaves.push(tagged);
          tier1TripIds.add(tripId);
        }
        if (matches.length > 0) {
          suggestedTripMap.set(save.id, matches.map((tid) => ({
            id: tid,
            name: upcomingTripIndex.get(tid)!.tripName,
          })));
        }
      }

      // ── TIER 2: within 150km of a declared trip city ──────────────────────
      if (save.lat != null && save.lng != null) {
        for (const t of upcomingTrips) {
          if (tier1TripIds.has(t.id)) continue;
          const cities = upcomingTripCities.get(t.id) ?? [];
          if (cities.length === 0) continue; // Tier 3 handles country-scoped trips
          const primaryCountry = upcomingTripPrimaryCountry.get(t.id) ?? "";
          let withinReach = false;
          for (const city of cities) {
            const coordKey = `${city},${primaryCountry.toLowerCase()}`;
            const coords = tripCityCoords[coordKey];
            if (!coords) continue;
            if (haversineKm({ lat: save.lat, lng: save.lng }, coords) <= WITHIN_REACH_KM) {
              withinReach = true;
              break;
            }
          }
          if (withinReach) {
            const tagged: Save = { ...save, suggestionTier: "secondary" };
            upcomingTripIndex.get(t.id)!.suggestedSaves.push(tagged);
            tier2TripIds.add(t.id);
            const existing = suggestedTripMap.get(save.id) ?? [];
            if (!existing.find((o) => o.id === t.id)) {
              existing.push({ id: t.id, name: upcomingTripIndex.get(t.id)!.tripName });
              suggestedTripMap.set(save.id, existing);
            }
          }
        }
      }

      // ── TIER 3: country-scoped trip (trip.cities is empty) ────────────────
      if (countryKey) {
        for (const t of upcomingTrips) {
          if (tier1TripIds.has(t.id) || tier2TripIds.has(t.id)) continue;
          const cities = upcomingTripCities.get(t.id) ?? [];
          if (cities.length > 0) continue; // has declared cities, skip
          const countries = upcomingTripCountries.get(t.id) ?? [];
          if (countries.includes(countryKey)) {
            const tagged: Save = { ...save, suggestionTier: "secondary" };
            upcomingTripIndex.get(t.id)!.suggestedSaves.push(tagged);
            const existing = suggestedTripMap.get(save.id) ?? [];
            if (!existing.find((o) => o.id === t.id)) {
              existing.push({ id: t.id, name: upcomingTripIndex.get(t.id)!.tripName });
              suggestedTripMap.set(save.id, existing);
            }
          }
        }
      }

      // If placed in at least one upcoming trip, continue
      if (tier1TripIds.size > 0 || tier2TripIds.size > 0 || suggestedTripMap.has(save.id)) continue;

      // Fall through to past city/country routing
      if (cityKey && pastTripCities.has(cityKey)) {
        const city = save.destinationCity ?? "Unknown";
        const list = pastCityMap.get(city) ?? [];
        list.push(save);
        pastCityMap.set(city, list);
        continue;
      }
      if (countryKey && pastTripCountries.has(countryKey)) {
        const city = save.destinationCity ?? "Unknown";
        const list = pastCityMap.get(city) ?? [];
        list.push(save);
        pastCityMap.set(city, list);
        continue;
      }
    }

    unassigned.push(save);
  }

  for (const section of upcomingSections) {
    section.explicitSaves.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
    section.suggestedSaves.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
  }

  const pastSections: PastCitySection[] = Array.from(pastCityMap.entries())
    .map(([city, citySaves]) => ({
      city,
      saves: citySaves.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")),
    }))
    .sort((a, b) => a.city.localeCompare(b.city));

  const sortByCity = (a: Save, b: Save) => {
    const cityA = (a.destinationCity ?? "").toLowerCase();
    const cityB = (b.destinationCity ?? "").toLowerCase();
    if (cityA !== cityB) {
      if (!cityA) return 1;
      if (!cityB) return -1;
      return cityA.localeCompare(cityB);
    }
    return (a.title ?? "").localeCompare(b.title ?? "");
  };
  unassigned.sort(sortByCity);
  imported.sort(sortByCity);

  return {
    upcoming: upcomingSections,
    past: pastSections,
    unassigned,
    imported,
    counts: {
      upcoming: upcomingSections.reduce((sum, s) => sum + s.explicitSaves.length + s.suggestedSaves.length, 0),
      past: pastSections.reduce((sum, s) => sum + s.saves.length, 0),
      unassigned: unassigned.length,
      imported: imported.length,
    },
    suggestedTripMap,
  };
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, badge, count, action }: {
  icon?: React.ReactNode;
  title: string;
  badge?: string;
  count: number;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid rgba(0,0,0,0.06)", marginBottom: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {icon}
        <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>{title}</span>
        {badge && <span style={{ fontSize: "14px" }}>{badge}</span>}
        <span style={{ fontSize: "12px", color: "#717171" }}>{count} {count === 1 ? "save" : "saves"}</span>
      </div>
      {action && (
        <button onClick={action.onClick} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#C4664A", fontWeight: 600, padding: 0, flexShrink: 0 }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── CardGrid ─────────────────────────────────────────────────────────────────

function CardGrid({ cards, openDropdown, setOpenDropdown, assignTrip, onTripClick, onCardClick, availableTrips, onDeleted, onIdentifyPlace, onRateClick, ratedItemId, onAssignCity, onShareToast }: {
  cards: Save[];
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  assignTrip: (id: string, trip: string) => void;
  onTripClick: (tripName: string) => void;
  onCardClick: (id: string) => void;
  availableTrips: { id: string; title: string; endDate?: string | null }[];
  onDeleted?: (id: string) => void;
  onIdentifyPlace?: (id: string) => void;
  onRateClick?: (id: string, title: string) => void;
  ratedItemId?: string | null;
  onAssignCity?: (id: string) => void;
  onShareToast?: (message: string) => void;
}) {
  return (
    <SavesCardGrid>
      {cards.map((save) => (
        <SaveCard key={save.id} save={save} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} assignTrip={assignTrip} onTripClick={onTripClick} onCardClick={onCardClick} availableTrips={availableTrips} onDeleted={onDeleted} onIdentifyPlace={onIdentifyPlace} onRateClick={onRateClick} ratedItemId={ratedItemId} onAssignCity={onAssignCity} onShareToast={onShareToast} />
      ))}
    </SavesCardGrid>
  );
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

function sortCardsAlphabetical(a: Save, b: Save): number {
  const titleA = (a.title ?? "").trim();
  const titleB = (b.title ?? "").trim();
  if (titleA && titleB) return titleA.localeCompare(titleB);
  if (titleA) return -1;
  if (titleB) return 1;
  return 0;
}

interface SavesGrouping {
  unassigned: Save[];
  cityGroups: Array<{ city: string; saves: Save[] }>;
  otherPlaces: Save[];
  totalCount: number;
}

function groupSaves(saves: Save[]): SavesGrouping {
  const unassigned: Save[] = [];
  const cityMap = new Map<string, Save[]>();

  for (const save of saves) {
    const city = save.destinationCity?.trim();
    if (!city) {
      unassigned.push(save);
      continue;
    }
    const existing = cityMap.get(city) ?? [];
    existing.push(save);
    cityMap.set(city, existing);
  }

  const cityGroups: Array<{ city: string; saves: Save[] }> = [];
  const otherPlaces: Save[] = [];

  for (const [city, citySaves] of cityMap.entries()) {
    if (citySaves.length >= 3) {
      cityGroups.push({ city, saves: citySaves });
    } else {
      otherPlaces.push(...citySaves);
    }
  }

  cityGroups.sort((a, b) => {
    if (b.saves.length !== a.saves.length) return b.saves.length - a.saves.length;
    return a.city.localeCompare(b.city);
  });

  for (const group of cityGroups) {
    group.saves.sort(sortCardsAlphabetical);
  }

  unassigned.sort(sortCardsAlphabetical);
  otherPlaces.sort(sortCardsAlphabetical);

  return { unassigned, cityGroups, otherPlaces, totalCount: saves.length };
}

// ─── OtherPlacesSection ───────────────────────────────────────────────────────

function OtherPlacesSection({ saves, openDropdown, setOpenDropdown, assignTrip, onCardClick, availableTrips, onDeleted, onIdentifyPlace, onRateClick, ratedItemId, onShareToast }: {
  saves: Save[];
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  assignTrip: (id: string, trip: string) => void;
  onCardClick: (id: string) => void;
  availableTrips: { id: string; title: string; endDate?: string | null }[];
  onDeleted?: (id: string) => void;
  onIdentifyPlace?: (id: string) => void;
  onRateClick?: (id: string, title: string) => void;
  ratedItemId?: string | null;
  onShareToast?: (message: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginBottom: "32px" }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid rgba(0,0,0,0.06)", marginBottom: expanded ? "12px" : 0 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>Other places</span>
          <span style={{ fontSize: "12px", color: "#717171" }}>{saves.length} {saves.length === 1 ? "save" : "saves"}</span>
        </div>
        <span style={{ fontSize: "14px", color: "#717171", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▾</span>
      </div>
      {expanded && (
        <CardGrid cards={saves} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} assignTrip={assignTrip} onTripClick={() => {}} onCardClick={onCardClick} availableTrips={availableTrips} onDeleted={onDeleted} onIdentifyPlace={onIdentifyPlace} onRateClick={onRateClick} ratedItemId={ratedItemId} onShareToast={onShareToast} />
      )}
    </div>
  );
}

// ─── Tab content components ───────────────────────────────────────────────────

const SHOW_MORE_STYLE: React.CSSProperties = {
  marginTop: 12,
  padding: "8px 16px",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  background: "white",
  color: "#1B3A5C",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

function UpcomingTabContent({ sections, expandedSections, setExpandedSections, suggestedTripMap, onAddToTrip, onGrowTripCities, sharedProps }: {
  sections: UpcomingTripSection[];
  expandedSections: Set<string>;
  setExpandedSections: (s: Set<string>) => void;
  suggestedTripMap: Map<string, Array<{ id: string; name: string }>>;
  onAddToTrip: (saveId: string, options: Array<{ id: string; name: string }>) => void;
  onGrowTripCities: (saveId: string, tripId: string, newCity: string, currentCities: string[]) => void;
  sharedProps: SharedCardGridProps;
}) {
  if (sections.every((s) => s.explicitSaves.length + s.suggestedSaves.length === 0)) {
    return <p style={{ color: "#6B7280", textAlign: "center", padding: "40px 0", fontSize: 14 }}>No upcoming trips yet. Add one to start planning.</p>;
  }
  return (
    <>
      {sections.map((section) => {
        const totalCount = section.explicitSaves.length + section.suggestedSaves.length;
        if (totalCount === 0) return null;
        const expanded = expandedSections.has(section.tripId);
        const explicitShown = expanded ? section.explicitSaves : section.explicitSaves.slice(0, 3);
        const suggestedShown = expanded ? section.suggestedSaves : section.suggestedSaves.slice(0, Math.max(0, 3 - explicitShown.length));
        return (
          <section key={section.tripId} style={{ marginBottom: 32 }}>
            <div style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1B3A5C", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>
                {section.tripName}
                {section.startDate && (
                  <span style={{ color: "#64748B", fontWeight: 500, fontSize: 13, marginLeft: 8 }}>
                    {formatTripDateRange(section.startDate, section.endDate)}
                  </span>
                )}
              </h3>
              <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0 0" }}>
                {totalCount} {totalCount === 1 ? "save" : "saves"}
                {section.suggestedSaves.length > 0 && ` • ${section.suggestedSaves.length} suggested`}
              </p>
            </div>
            <SavesCardGrid>
              {explicitShown.map((save) => (
                <SaveCard key={save.id} save={save} {...sharedProps} onTripClick={() => {}} cardContext="upcoming_explicit" />
              ))}
              {suggestedShown.map((save) => {
                const options = suggestedTripMap.get(save.id) ?? [];
                return (
                  <SaveCard
                    key={save.id}
                    save={save}
                    {...sharedProps}
                    onTripClick={() => {}}
                    suggestedForOptions={options.length > 0 ? options : undefined}
                    onAddToTrip={options.length > 0 ? onAddToTrip : undefined}
                  />
                );
              })}
            </SavesCardGrid>
            {totalCount > 3 && (
              <button
                type="button"
                onClick={() => {
                  const next = new Set(expandedSections);
                  if (expanded) next.delete(section.tripId); else next.add(section.tripId);
                  setExpandedSections(next);
                }}
                style={SHOW_MORE_STYLE}
              >
                {expanded ? "Show less" : `Show all ${totalCount} saves →`}
              </button>
            )}
          </section>
        );
      })}
    </>
  );
}

function PastTabContent({ sections, expandedSections, setExpandedSections, sharedProps }: {
  sections: PastCitySection[];
  expandedSections: Set<string>;
  setExpandedSections: (s: Set<string>) => void;
  sharedProps: SharedCardGridProps;
}) {
  if (sections.length === 0) {
    return <p style={{ color: "#6B7280", textAlign: "center", padding: "40px 0", fontSize: 14 }}>No past-trip saves yet.</p>;
  }
  return (
    <>
      {sections.map((section) => {
        const key = `past-${section.city}`;
        const expanded = expandedSections.has(key);
        const shown = expanded ? section.saves : section.saves.slice(0, 3);
        return (
          <section key={section.city} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1B3A5C", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>{section.city}</h3>
              <span style={{ fontSize: 12, color: "#64748B" }}>{section.saves.length} {section.saves.length === 1 ? "save" : "saves"}</span>
            </div>
            <SavesCardGrid>
              {shown.map((save) => (
                <SaveCard key={save.id} save={save} {...sharedProps} onTripClick={() => {}} cardContext="past" />
              ))}
            </SavesCardGrid>
            {section.saves.length > 3 && (
              <button
                type="button"
                onClick={() => {
                  const next = new Set(expandedSections);
                  if (expanded) next.delete(key); else next.add(key);
                  setExpandedSections(next);
                }}
                style={SHOW_MORE_STYLE}
              >
                {expanded ? "Show less" : `Show all ${section.saves.length} saves →`}
              </button>
            )}
          </section>
        );
      })}
    </>
  );
}

// ─── CityGroupSection ─────────────────────────────────────────────────────────
function CityGroupSection({ city, saves, sharedProps, onAssignCity, defaultExpanded = false }: {
  city: string;
  saves: Save[];
  sharedProps: SharedCardGridProps;
  onAssignCity: (id: string) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showAll, setShowAll] = useState(false);
  const PREVIEW = 6;
  const shown = showAll ? saves : saves.slice(0, PREVIEW);
  return (
    <div style={{ marginBottom: "28px" }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid rgba(0,0,0,0.06)", marginBottom: expanded ? "14px" : 0 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a1a" }}>{city}</span>
          <span style={{ fontSize: "12px", color: "#717171", fontWeight: 500 }}>{saves.length} {saves.length === 1 ? "save" : "saves"}</span>
        </div>
        <span style={{ fontSize: "14px", color: "#717171", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▾</span>
      </div>
      {expanded && (
        <>
          <CardGrid cards={shown} openDropdown={sharedProps.openDropdown} setOpenDropdown={sharedProps.setOpenDropdown} assignTrip={sharedProps.assignTrip} onTripClick={() => {}} onCardClick={sharedProps.onCardClick} availableTrips={sharedProps.availableTrips} onDeleted={sharedProps.onDeleted} onIdentifyPlace={sharedProps.onIdentifyPlace} onRateClick={sharedProps.onRateClick} ratedItemId={sharedProps.ratedItemId} onAssignCity={onAssignCity} onShareToast={sharedProps.onShareToast} />
          {saves.length > PREVIEW && (
            <button type="button" onClick={() => setShowAll(a => !a)} style={SHOW_MORE_STYLE}>
              {showAll ? "Show less" : `Show all ${saves.length} saves →`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function UnassignedTabContent({ items, sharedProps, onAssignCity }: {
  items: Save[];
  sharedProps: SharedCardGridProps;
  onAssignCity: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p style={{ color: "#6B7280", textAlign: "center", padding: "40px 0", fontSize: 14 }}>Every save is assigned or matched. You&apos;re on top of things.</p>;
  }

  const { cityGroups, otherPlaces, unassigned } = groupSaves(items);

  return (
    <section>
      {/* City groups — each with 3+ saves */}
      {cityGroups.map((group, i) => (
        <CityGroupSection
          key={group.city}
          city={group.city}
          saves={group.saves}
          sharedProps={sharedProps}
          onAssignCity={onAssignCity}
          defaultExpanded={i === 0}
        />
      ))}

      {/* Other places — cities with <3 saves */}
      {otherPlaces.length > 0 && (
        <OtherPlacesSection
          saves={otherPlaces}
          openDropdown={sharedProps.openDropdown}
          setOpenDropdown={sharedProps.setOpenDropdown}
          assignTrip={sharedProps.assignTrip}
          onCardClick={sharedProps.onCardClick}
          availableTrips={sharedProps.availableTrips}
          onDeleted={sharedProps.onDeleted}
          onIdentifyPlace={sharedProps.onIdentifyPlace}
          onRateClick={sharedProps.onRateClick}
          ratedItemId={sharedProps.ratedItemId}
          onShareToast={sharedProps.onShareToast}
        />
      )}

      {/* No city matched — truly unresolvable locations */}
      {unassigned.length > 0 && (
        <CityGroupSection
          city="No city matched"
          saves={unassigned}
          sharedProps={sharedProps}
          onAssignCity={onAssignCity}
          defaultExpanded={cityGroups.length === 0 && otherPlaces.length === 0}
        />
      )}
    </section>
  );
}

type ImportedCity = {
  cityName: string;
  citySlug: string | null;
  photoUrl: string | null;
  importCount: number;
  allCount: number;
};

type SharePopupState = {
  cityName: string;
  citySlug: string;
  importCount: number;
  allCount: number;
};

function CitySharePopup({
  state,
  onClose,
}: {
  state: SharePopupState;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState<"imports" | "all" | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleShare(scope: "imports" | "all") {
    setLoading(scope);
    try {
      const res = await fetch("/api/saves/city-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citySlug: state.citySlug, scope }),
      });
      if (!res.ok) throw new Error("Failed to create share link");
      const { url } = (await res.json()) as { url: string };
      if (navigator.share) {
        await navigator.share({ title: `My saves in ${state.cityName}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // ignore
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(0,0,0,0.35)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px 36px",
          width: "100%",
          maxWidth: 480,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ fontWeight: 700, fontSize: 16, color: "#1B3A5C", marginBottom: 6 }}>
          Share {state.cityName}
        </p>
        <p style={{ fontSize: 13, color: "#717171", marginBottom: 20 }}>
          Choose what to include in your shared link.
        </p>

        <button
          type="button"
          disabled={!!loading}
          onClick={() => handleShare("imports")}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid #EEEEEE",
            background: "#FAFAFA",
            cursor: "pointer",
            marginBottom: 10,
            opacity: loading ? 0.6 : 1,
          }}
        >
          <p style={{ fontWeight: 600, fontSize: 14, color: "#1B3A5C", marginBottom: 2 }}>
            {loading === "imports" ? "Generating link..." : `Just my Google Maps imports (${state.importCount})`}
          </p>
          <p style={{ fontSize: 12, color: "#717171" }}>Only your imported Google Maps saves</p>
        </button>

        <button
          type="button"
          disabled={!!loading}
          onClick={() => handleShare("all")}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid #EEEEEE",
            background: "#FAFAFA",
            cursor: "pointer",
            marginBottom: 16,
            opacity: loading ? 0.6 : 1,
          }}
        >
          <p style={{ fontWeight: 600, fontSize: 14, color: "#1B3A5C", marginBottom: 2 }}>
            {loading === "all" ? "Generating link..." : `Everything I've saved in ${state.cityName} (${state.allCount})`}
          </p>
          <p style={{ fontSize: 12, color: "#717171" }}>All saves including trip-assigned ones</p>
        </button>

        {copied && (
          <p style={{ fontSize: 13, color: "#C4664A", textAlign: "center", marginBottom: 12 }}>
            Link copied to clipboard
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            display: "block",
            width: "100%",
            textAlign: "center",
            padding: "12px",
            borderRadius: 10,
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: 14,
            color: "#717171",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ImportedTabContent({ items }: {
  items: Save[];
}) {
  const [cities, setCities] = useState<ImportedCity[]>([]);
  const [loadingCities, setLoadingCities] = useState(true);
  const [sharePopup, setSharePopup] = useState<SharePopupState | null>(null);

  useEffect(() => {
    fetch("/api/saves/imported-cities")
      .then((r) => r.json())
      .then((data: { cities?: ImportedCity[] }) => {
        setCities(data.cities ?? []);
      })
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [items.length]);

  if (items.length === 0) {
    return <p style={{ color: "#6B7280", textAlign: "center", padding: "40px 0", fontSize: 14 }}>No imported saves yet. Import your Google Maps lists to get started.</p>;
  }

  if (loadingCities) {
    return <p style={{ color: "#6B7280", textAlign: "center", padding: "40px 0", fontSize: 14 }}>Loading...</p>;
  }

  return (
    <section>
      <div
        className="grid grid-cols-3 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-2"
        style={{ gap: 16 }}
      >
        {cities.map((c) => {
          const slug = c.citySlug ?? c.cityName.toLowerCase().replace(/\s+/g, "-");
          return (
            <div key={c.cityName} style={{ position: "relative" }}>
              <CountryCityCard
                slug={slug}
                name={c.cityName}
                photoUrl={c.photoUrl}
                spotCount={c.importCount}
                href={`/saves/imported/${slug}`}
                countLabel={`${c.importCount} ${c.importCount === 1 ? "save" : "saves"}`}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSharePopup({
                    cityName: c.cityName,
                    citySlug: slug,
                    importCount: c.importCount,
                    allCount: c.allCount,
                  });
                }}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.92)",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                  color: "#C4664A",
                  fontSize: 14,
                  zIndex: 1,
                }}
                aria-label={`Share ${c.cityName}`}
              >
                ↗
              </button>
            </div>
          );
        })}
      </div>

      {sharePopup && (
        <CitySharePopup
          state={sharePopup}
          onClose={() => setSharePopup(null)}
        />
      )}
    </section>
  );
}

type SavedTourEntry = {
  id: string;
  title: string;
  createdAt: string;
  stopCount: number;
  destinationCountry?: string | null;
  destinationDisplayName: string;
  coverImage?: string | null;
};

const TOUR_GRID = "grid grid-cols-3 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1";

function ToursTabContent({ tours, search, activeCountry, selectedCity, onDelete }: {
  tours: Record<string, SavedTourEntry[]>;
  search: string;
  activeCountry: string;
  selectedCity: string | null;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();

  const filteredCities = Object.entries(tours)
    .map(([city, cityTours]): [string, SavedTourEntry[]] => {
      const filtered = cityTours.filter(t => {
        if (activeCountry !== "all" && t.destinationCountry !== activeCountry) return false;
        if (selectedCity !== null && city.trim() !== selectedCity) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!t.title.toLowerCase().includes(q) && !city.toLowerCase().includes(q)) return false;
        }
        return true;
      });
      return [city, filtered];
    })
    .filter(([, cityTours]) => cityTours.length > 0);

  const totalCount = filteredCities.reduce((sum, [, t]) => sum + t.length, 0);

  return (
    <section>
      {/* Create new tour — dashed card, first in grid */}
      <div className={TOUR_GRID} style={{ gap: 16, marginBottom: filteredCities.length > 0 ? 32 : 0 }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => router.push("/tour")}
          onKeyDown={(e) => { if (e.key === "Enter") router.push("/tour"); }}
          style={{ backgroundColor: "#FAFAFA", borderRadius: "12px", border: "2px dashed #CBD5E1", height: "210px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 8 }}
        >
          <span style={{ fontSize: 28, color: "#94A3B8", lineHeight: 1 }}>+</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>Create a new tour</span>
        </div>
      </div>

      {totalCount === 0 && (search.trim() || activeCountry !== "all" || selectedCity) && (
        <p style={{ color: "#6B7280", fontSize: 14, textAlign: "center", padding: "20px 0" }}>No tours match your search.</p>
      )}

      {filteredCities.map(([city, cityTours]) => (
        <div key={city} style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            {cityTours[0]?.destinationDisplayName ?? city} ({cityTours.length})
          </p>
          <div className={TOUR_GRID} style={{ gap: 16 }}>
            {cityTours.map(tour => (
              <div
                key={tour.id}
                className="group"
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/tour?id=${tour.id}`)}
                onKeyDown={(e) => { if (e.key === "Enter") router.push(`/tour?id=${tour.id}`); }}
                style={{ backgroundColor: "#FAFAFA", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "visible", display: "flex", flexDirection: "column", position: "relative", cursor: "pointer" }}
              >
                {/* Action menu */}
                <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
                  <TourActionMenu tourId={tour.id} onDelete={onDelete} anchorPosition="card" />
                </div>

                {/* Thumbnail */}
                <div
                  style={{
                    height: "130px",
                    backgroundImage: tour.coverImage ? `url(${tour.coverImage})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    position: "relative",
                    borderRadius: "12px 12px 0 0",
                    overflow: "hidden",
                    backgroundColor: "#f1f5f9",
                  }}
                >
                  <div style={{ position: "absolute", bottom: "6px", left: "8px", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "10px", padding: "2px 8px", borderRadius: "20px" }}>
                    Tour
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: "12px" }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", marginBottom: "4px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {tour.title.charAt(0).toUpperCase() + tour.title.slice(1)}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                    <MapPin size={11} style={{ color: "#9ca3af", flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tour.destinationDisplayName}</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
                    {tour.stopCount} stop{tour.stopCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

// ─── SavesScreen ──────────────────────────────────────────────────────────────

export function SavesScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [dietaryFilter, setDietaryFilter] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [activeCountry, setActiveCountry] = useState<string>("all");
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [saves, setSaves] = useState<Save[]>([]);
  const [availableTrips, setAvailableTrips] = useState<{ id: string; title: string; destinationCity: string | null; destinationCountry: string | null; cities: string[]; country: string | null; countries: string[]; startDate: string | null; endDate: string | null; isPlacesLibrary?: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showFabModal, setShowFabModal] = useState(false);
  const [fabUrl, setFabUrl] = useState("");
  const [modalItemId, setModalItemId] = useState<string | null>(null);
  const [identifyingItem, setIdentifyingItem] = useState<string | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [identifying, setIdentifying] = useState(false);
  const placeSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCategory, setManualCategory] = useState("food_and_drink");
  const [manualCity, setManualCity] = useState("");
  const [manualRegion, setManualRegion] = useState("");
  const [manualCountry, setManualCountry] = useState("");
  const [manualCityQuery, setManualCityQuery] = useState("");
  const [manualCitySuggestions, setManualCitySuggestions] = useState<{ placeId: string; cityName: string; countryName: string; region: string; description?: string }[]>([]);
  const [manualCityShowDropdown, setManualCityShowDropdown] = useState(false);
  const manualCityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualCityDropdownRef = useRef<HTMLDivElement>(null);
  const [manualNotes, setManualNotes] = useState("");
  const [manualWebsite, setManualWebsite] = useState("");
  const [manualIsVegetarian, setManualIsVegetarian] = useState(false);
  const [manualIsVegan, setManualIsVegan] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [ratingModal, setRatingModal] = useState<{ id: string; title: string } | null>(null);
  const [ratedItemId, setRatedItemId] = useState<string | null>(null);
  const [assignCityItemId, setAssignCityItemId] = useState<string | null>(null);
  const initialTab = (searchParams.get("tab") ?? "upcoming") as "upcoming" | "past" | "unassigned" | "imported" | "tours";
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "unassigned" | "imported" | "tours">(initialTab);
  const [savedTours, setSavedTours] = useState<Record<string, SavedTourEntry[]>>({});
  const [tripCityCoords, setTripCityCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [addToTripModal, setAddToTripModal] = useState<{ saveId: string; options: Array<{ id: string; name: string }> } | null>(null);

  // Maps import
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/saves").then(r => r.json()),
      fetch("/api/trips?status=ALL").then(r => r.json()),
      fetch("/api/tours/my-tours").then(r => r.json()),
    ]).then(([savesData, tripsData, toursData]) => {
      setSaves((savesData.saves ?? []).map(mapApiItem));
      // TODO: move isPlacesLibrary filter server-side in a future cleanup prompt
      const allTrips = (tripsData.trips ?? []).filter((t: { isPlacesLibrary?: boolean }) => !t.isPlacesLibrary);
      setAvailableTrips(allTrips);
      setSavedTours(toursData && typeof toursData === "object" && !toursData.error ? toursData : {});
      setLoading(false);

      // Geocode trip city coords for Tier 2 suggestion matching
      const seen = new Set<string>();
      const pairs: Array<{ city: string; country: string | null }> = [];
      for (const t of allTrips) {
        const countries: string[] = t.countries?.length > 0 ? t.countries : (t.country ? [t.country] : []);
        const primaryCountry = countries[0] ?? null;
        const cities: string[] = t.cities ?? [];
        for (const city of cities) {
          const key = `${city.toLowerCase()},${(primaryCountry ?? "").toLowerCase()}`;
          if (!seen.has(key)) { seen.add(key); pairs.push({ city, country: primaryCountry }); }
        }
      }
      if (pairs.length > 0) {
        fetch("/api/trips/cities-geo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cities: pairs }),
        }).then(r => r.json()).then(coords => {
          if (coords && typeof coords === "object") setTripCityCoords(coords);
        }).catch(() => { /* non-fatal — Tier 2 simply returns no matches */ });
      }
    }).catch(() => setLoading(false));
  }, []);

  // Auto-open modal when ?open=<id> is present (e.g. from email deep link)
  useEffect(() => {
    const openId = new URLSearchParams(window.location.search).get("open");
    if (openId) setModalItemId(openId);
  }, []);

  // Pre-fill and auto-open manual Add modal when ?city= AND ?category= are both present.
  // Only fires on deep-link arrival from city page CTAs — bare /saves visits are unaffected.
  useEffect(() => {
    const city = searchParams.get("city");
    const category = searchParams.get("category");
    if (!city || !category) return;
    setManualCityQuery(city);
    setManualCity(city);
    setManualCategory(category);
    setShowManualModal(true);
  }, [searchParams]);


  // Dismiss city dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (manualCityDropdownRef.current && !manualCityDropdownRef.current.contains(e.target as Node)) {
        setManualCityShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // City autocomplete debounce
  useEffect(() => {
    if (manualCityDebounceRef.current) clearTimeout(manualCityDebounceRef.current);
    if (manualCityQuery.length < 2) {
      setManualCitySuggestions([]);
      setManualCityShowDropdown(false);
      return;
    }
    manualCityDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/destinations/lookup?q=${encodeURIComponent(manualCityQuery)}`);
        const data = await res.json();
        setManualCitySuggestions(Array.isArray(data) ? data : []);
        setManualCityShowDropdown(true);
      } catch {
        setManualCitySuggestions([]);
      }
    }, 400);
    return () => { if (manualCityDebounceRef.current) clearTimeout(manualCityDebounceRef.current); };
  }, [manualCityQuery]);

  // Cascading reset: changing country resets city selection
  useEffect(() => {
    setSelectedCity(null);
    setCitySearch("");
  }, [activeCountry]);

  // Click-outside dismissal for country + city dropdowns
  useEffect(() => {
    if (!countryDropdownOpen && !cityDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-saves-filter-dropdown]")) {
        setCountryDropdownOpen(false);
        setCityDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [countryDropdownOpen, cityDropdownOpen]);


  function selectManualCity(cityName: string, countryName: string, region: string) {
    setManualCity(cityName);
    setManualRegion(region);
    setManualCountry(countryName);
    setManualCityQuery(countryName ? `${cityName}, ${countryName}` : cityName);
    setManualCitySuggestions([]);
    setManualCityShowDropdown(false);
  }

  const handlePlaceSearch = (query: string) => {
    if (placeSearchTimeout.current) clearTimeout(placeSearchTimeout.current);
    if (query.length < 3) { setPlaceResults([]); return; }
    placeSearchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setPlaceResults(data.places ?? []);
      } catch { setPlaceResults([]); }
    }, 300);
  };

  const handleSelectPlace = async (place: PlaceResult) => {
    if (!identifyingItem) return;
    setIdentifying(true);
    try {
      const res = await fetch(`/api/saves/${identifyingItem}/identify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawTitle: place.name,
          lat: place.geometry?.location?.lat ?? null,
          lng: place.geometry?.location?.lng ?? null,
          photoReference: place.photos?.[0]?.photo_reference ?? null,
          needsPlaceConfirmation: false,
        }),
      });
      const data = await res.json() as { savedItem?: { placePhotoUrl?: string | null } };
      const photoUrl = data.savedItem?.placePhotoUrl ?? null;
      setSaves((prev) => prev.map((s) =>
        s.id === identifyingItem
          ? { ...s, title: place.name, img: photoUrl ?? s.img, needsPlaceConfirmation: false }
          : s
      ));
    } catch { /* silent */ }
    setIdentifyingItem(null);
    setPlaceQuery("");
    setPlaceResults([]);
    setIdentifying(false);
  };

  const assignTrip = (id: string, tripTitle: string) => {
    if (tripTitle === "+ Create new trip") { setOpenDropdown(null); return; }
    const trip = availableTrips.find(t => t.title === tripTitle);
    setSaves((prev) => prev.map((s) => (s.id === id ? { ...s, assigned: tripTitle, tripId: trip?.id ?? s.tripId } : s)));
    setOpenDropdown(null);
    if (trip) {
      fetch(`/api/saves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id }),
      }).catch(() => {/* silent */});
    }
  };

  const handleTagsUpdated = (itemId: string, tags: string[]) => {
    setSaves((prev) => prev.map((s) => (s.id === itemId ? { ...s, tags } : s)));
  };

  const handleItemDeleted = (deletedId: string) => {
    setSaves((prev) => prev.filter((s) => s.id !== deletedId));
  };

  const handleAssignCity = async (cityName: string, countryName: string) => {
    if (!assignCityItemId) return;
    const id = assignCityItemId;
    try {
      const res = await fetch(`/api/saves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationCity: cityName, destinationCountry: countryName || null }),
      });
      if (res.ok) {
        setSaves(prev => prev.map(s =>
          s.id === id
            ? { ...s, destinationCity: cityName, destinationCountry: countryName || null, location: [cityName, countryName].filter(Boolean).join(", ") }
            : s
        ));
        setAssignCityItemId(null);
        setManualCityQuery("");
        setManualCity("");
        setManualCountry("");
        setManualCitySuggestions([]);
        setSavedToast("Location assigned");
        setTimeout(() => setSavedToast(null), 3000);
      }
    } catch { /* silent */ }
  };

  const doAssignToTrip = async (saveId: string, tripId: string, tripName: string) => {
    const save = saves.find(s => s.id === saveId);
    const destinationCity = save?.destinationCity ?? null;
    const trip = availableTrips.find(t => t.id === tripId);
    const existingCities = trip?.cities ?? [];
    const cityNotInTrip = destinationCity && !existingCities.map(c => c.toLowerCase()).includes(destinationCity.toLowerCase());

    setSaves(prev => prev.map(s => s.id === saveId ? { ...s, tripId, assigned: tripName } : s));
    if (cityNotInTrip) {
      setAvailableTrips(prev => prev.map(t => t.id === tripId ? { ...t, cities: [...existingCities, destinationCity!] } : t));
    }
    setAddToTripModal(null);
    try {
      if (cityNotInTrip) {
        try {
          await fetch(`/api/trips/${tripId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cities: [...existingCities, destinationCity!] }),
          });
        } catch (e) {
          console.error("[doAssignToTrip] city-grow failed:", e);
        }
      }
      await fetch(`/api/saves/${saveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
    } catch { /* silent */ }
  };

  const handleAddToTrip = (saveId: string, options: Array<{ id: string; name: string }>) => {
    if (options.length === 1) {
      doAssignToTrip(saveId, options[0].id, options[0].name);
    } else {
      setAddToTripModal({ saveId, options });
    }
  };

  const handleGrowTripCities = async (saveId: string, tripId: string, newCity: string, currentCities: string[]) => {
    const newCities = [...currentCities, newCity];
    // Optimistic: assign save to trip and expand trip's city list
    setSaves(prev => prev.map(s => s.id === saveId ? { ...s, tripId, assigned: newCity } : s));
    setAvailableTrips(prev => prev.map(t => t.id === tripId ? { ...t, cities: newCities } : t));
    setSavedToast(`${newCity} added to trip`);
    setTimeout(() => setSavedToast(null), 3000);
    try {
      await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cities: newCities }),
      });
      await fetch(`/api/saves/${saveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
    } catch { /* silent */ }
  };

  const handleManualSave = async () => {
    if (!manualName.trim()) return;
    setManualSubmitting(true);
    try {
      const dietaryTags: string[] = [];
      if (manualIsVegan) { dietaryTags.push("VGN"); dietaryTags.push("VG"); }
      else if (manualIsVegetarian) { dietaryTags.push("VG"); }

      const res = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceMethod: "URL_PASTE",
          title: manualName.trim(),
          category: manualCategory || null,
          city: manualCity.trim() || null,
          region: manualRegion.trim() || null,
          country: manualCountry.trim() || null,
          notes: manualNotes.trim() || null,
          website: manualWebsite.trim() || null,
          tags: dietaryTags.length > 0 ? dietaryTags : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.savedItem) {
        const tripForItem = data.matchedTrip ? { id: data.matchedTrip.id, title: data.matchedTrip.title } : null;
        setSaves((prev) => [mapApiItem({ ...data.savedItem, trip: tripForItem, needsPlaceConfirmation: false }), ...prev]);
        setShowManualModal(false);
        setManualName("");
        setManualCategory("food_and_drink");
        setManualCity("");
        setManualRegion("");
        setManualCountry("");
        setManualCityQuery("");
        setManualNotes("");
        setManualWebsite("");
        setManualIsVegetarian(false);
        setManualIsVegan(false);
        const toastMsg = data.matchedTrip
          ? `Saved and added to ${data.matchedTrip.title}`
          : "Activity saved";
        setSavedToast(toastMsg);
        setTimeout(() => setSavedToast(null), 3500);
      }
    } finally {
      setManualSubmitting(false);
    }
  };

  // Count saves per country, sorted desc
  const countryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of saves) {
      const c = s.destinationCountry?.trim();
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [saves]);

  // Count saves per city, scoped to activeCountry
  const cityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of saves) {
      if (activeCountry !== "all" && s.destinationCountry?.trim() !== activeCountry) continue;
      const c = s.destinationCity?.trim();
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [saves, activeCountry]);

  // Filtered dropdown lists based on search input
  const filteredCountries = countryCounts.filter(c =>
    c.name.toLowerCase().includes(countrySearch.trim().toLowerCase())
  );
  const filteredCities = cityCounts.filter(c =>
    c.name.toLowerCase().includes(citySearch.trim().toLowerCase())
  );

  // City filter — applied before category/search
  const cityFiltered = saves.filter(s => {
    if (activeCountry !== "all" && s.destinationCountry !== activeCountry) return false;
    if (selectedCity !== null && s.destinationCity?.trim() !== selectedCity) return false;
    return true;
  });

  const categoryCounts = CATEGORIES
    .map((c) => ({
      slug: c.slug,
      label: c.label,
      count: cityFiltered.filter((s) =>
        s.tags.some((t) => t === c.slug || normalizeCategorySlug(t) === c.slug)
      ).length,
    }))
    .filter((c) => c.count > 0);

  // Card matching: search + category filter (ignores assigned/unassigned axis)
  const matchesFilter = (s: Save): boolean => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      !searchLower ||
      s.title.toLowerCase().includes(searchLower) ||
      s.location.toLowerCase().includes(searchLower) ||
      (s.assigned?.toLowerCase().includes(searchLower) ?? false) ||
      s.tags.some(tag => categoryLabel(tag).toLowerCase().includes(searchLower));
    const matchesCategory =
      activeFilter === null
        ? true
        : s.tags.some(t => t === activeFilter || normalizeCategorySlug(t) === activeFilter);
    const matchesDietary =
      dietaryFilter === "Vegetarian"
        ? s.tags.includes("VG") || s.tags.includes("VGN")
        : dietaryFilter === "Vegan"
        ? s.tags.includes("VGN")
        : true;
    return matchesSearch && matchesCategory && matchesDietary;
  };

  const filteredSaves = cityFiltered.filter(matchesFilter);
  const tabbed = groupTabbedSaves(filteredSaves, availableTrips, tripCityCoords);
  const toursCount = Object.values(savedTours).reduce((sum, arr) => sum + arr.length, 0);
  const isEmptyLibrary = !loading && saves.length === 0;
  const hasNoResults = !loading && !isEmptyLibrary && activeTab !== "tours" && tabbed.counts.upcoming === 0 && tabbed.counts.past === 0 && tabbed.counts.unassigned === 0 && tabbed.counts.imported === 0;

  return (
    <div
      onClick={() => setOpenDropdown(null)}
      style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", padding: "24px", paddingBottom: "100px" }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>

        {/* TOP BAR */}
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px", fontFamily: "'Playfair Display', Georgia, serif" }}>
            Your saves
          </h1>
          <p style={{ fontSize: "13px", color: "#717171", marginBottom: "16px" }}>
Your saved places, all in one spot
          </p>
          {/* Search bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.1)", padding: "0 14px", height: "44px" }}>
            <Search size={16} style={{ color: "#717171", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search saves..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "#1a1a1a", backgroundColor: "transparent" }}
            />
            {search.length > 0 && (
              <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                <X size={14} style={{ color: "#717171" }} />
              </button>
            )}
          </div>
        </div>

        {/* COUNTRY + CITY DROPDOWNS */}
        <div
          data-saves-filter-dropdown=""
          style={{ display: "flex", gap: 12, marginBottom: 16, position: "relative", flexWrap: "wrap" }}
        >
          {/* COUNTRY DROPDOWN */}
          <div style={{ position: "relative", minWidth: 200 }}>
            <button
              type="button"
              onClick={() => { setCountryDropdownOpen(o => !o); setCityDropdownOpen(false); }}
              style={{ padding: "8px 14px", fontSize: 14, fontWeight: 500, color: "#1B3A5C", background: "#fff", border: "1px solid #D4C4B8", borderRadius: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, minWidth: 200, justifyContent: "space-between" }}
            >
              <span>{activeCountry === "all" ? `All countries (${saves.length})` : `${activeCountry} (${countryCounts.find(c => c.name === activeCountry)?.count ?? 0})`}</span>
              <span style={{ fontSize: 10, color: "#666" }}>▾</span>
            </button>
            {countryDropdownOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #D4C4B8", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 20, maxHeight: 320, overflowY: "auto", overscrollBehaviorY: "contain" }}>
                <input
                  type="text"
                  value={countrySearch}
                  onChange={e => setCountrySearch(e.target.value)}
                  placeholder="Search countries..."
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "none", borderBottom: "1px solid #E8D5C8", outline: "none", boxSizing: "border-box" }}
                />
                <div
                  onClick={() => { setActiveCountry("all"); setCountryDropdownOpen(false); setCountrySearch(""); }}
                  style={{ padding: "8px 14px", fontSize: 13, cursor: "pointer", background: activeCountry === "all" ? "#F5EDE5" : "transparent", fontWeight: activeCountry === "all" ? 600 : 400, color: "#1B3A5C" }}
                >
                  All countries ({saves.length})
                </div>
                {filteredCountries.map(c => (
                  <div
                    key={c.name}
                    onClick={() => { setActiveCountry(c.name); setCountryDropdownOpen(false); setCountrySearch(""); }}
                    style={{ padding: "8px 14px", fontSize: 13, cursor: "pointer", background: activeCountry === c.name ? "#F5EDE5" : "transparent", fontWeight: activeCountry === c.name ? 600 : 400, color: "#1B3A5C", display: "flex", justifyContent: "space-between" }}
                  >
                    <span>{c.name}</span>
                    <span style={{ color: "#999", fontSize: 12 }}>{c.count}</span>
                  </div>
                ))}
                {filteredCountries.length === 0 && countrySearch && (
                  <div style={{ padding: "12px 14px", fontSize: 13, color: "#999", fontStyle: "italic" }}>No matches</div>
                )}
              </div>
            )}
          </div>

          {/* CITY DROPDOWN */}
          <div style={{ position: "relative", minWidth: 200 }}>
            <button
              type="button"
              onClick={() => { setCityDropdownOpen(o => !o); setCountryDropdownOpen(false); }}
              style={{ padding: "8px 14px", fontSize: 14, fontWeight: 500, color: "#1B3A5C", background: "#fff", border: "1px solid #D4C4B8", borderRadius: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, minWidth: 200, justifyContent: "space-between" }}
            >
              <span>{selectedCity === null
                ? (activeCountry === "all" ? `All cities (${cityCounts.length})` : `All cities in ${activeCountry}`)
                : `${selectedCity} (${cityCounts.find(c => c.name === selectedCity)?.count ?? 0})`
              }</span>
              <span style={{ fontSize: 10, color: "#666" }}>▾</span>
            </button>
            {cityDropdownOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #D4C4B8", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 20, maxHeight: 320, overflowY: "auto", overscrollBehaviorY: "contain" }}>
                <input
                  type="text"
                  value={citySearch}
                  onChange={e => setCitySearch(e.target.value)}
                  placeholder="Search cities..."
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "none", borderBottom: "1px solid #E8D5C8", outline: "none", boxSizing: "border-box" }}
                />
                <div
                  onClick={() => { setSelectedCity(null); setCityDropdownOpen(false); setCitySearch(""); }}
                  style={{ padding: "8px 14px", fontSize: 13, cursor: "pointer", background: selectedCity === null ? "#F5EDE5" : "transparent", fontWeight: selectedCity === null ? 600 : 400, color: "#1B3A5C" }}
                >
                  All cities{activeCountry !== "all" ? ` in ${activeCountry}` : ""}
                </div>
                {filteredCities.map(c => (
                  <div
                    key={c.name}
                    onClick={() => { setSelectedCity(c.name); setCityDropdownOpen(false); setCitySearch(""); }}
                    style={{ padding: "8px 14px", fontSize: 13, cursor: "pointer", background: selectedCity === c.name ? "#F5EDE5" : "transparent", fontWeight: selectedCity === c.name ? 600 : 400, color: "#1B3A5C", display: "flex", justifyContent: "space-between" }}
                  >
                    <span>{c.name}</span>
                    <span style={{ color: "#999", fontSize: 12 }}>{c.count}</span>
                  </div>
                ))}
                {filteredCities.length === 0 && citySearch && (
                  <div style={{ padding: "12px 14px", fontSize: 13, color: "#999", fontStyle: "italic" }}>No matches</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* FILTER STRIP */}
        <div style={{ marginBottom: "24px" }}>
          <CategoryFilterChips
            selected={activeFilter}
            available={categoryCounts}
            onSelect={(slug) => {
              setActiveFilter(slug);
              if (slug !== "food_and_drink") setDietaryFilter(null);
            }}
          />
        </div>

        {activeFilter === "food_and_drink" && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '-16px', marginBottom: '24px' }}>
            {["All Food", "Vegetarian", "Vegan"].map(sub => {
              const isActive = sub === "All Food" ? dietaryFilter === null : dietaryFilter === sub;
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setDietaryFilter(sub === "All Food" ? null : sub)}
                  style={{
                    display: "inline-flex", alignItems: "center", height: "24px",
                    padding: "0 10px", borderRadius: "9999px", fontSize: "12px", fontWeight: 500,
                    border: "1px solid #16a34a", flexShrink: 0, cursor: "pointer",
                    background: isActive ? "#16a34a" : "white",
                    color: isActive ? "white" : "#16a34a",
                    transition: "background-color 150ms ease, color 150ms ease",
                    fontFamily: "inherit",
                  }}
                >
                  {sub}
                </button>
              );
            })}
          </div>
        )}

        {/* TAB BAR */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #E5E7EB", marginBottom: 20, overflowX: "auto" }}>
          {([
            { id: "upcoming", label: "Upcoming", count: tabbed.counts.upcoming },
            { id: "past", label: "Past", count: tabbed.counts.past },
            { id: "unassigned", label: "Unassigned", count: tabbed.counts.unassigned },
            { id: "imported", label: "Imported", count: tabbed.counts.imported },
            { id: "tours", label: "Tours", count: toursCount },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "12px 16px",
                border: "none",
                background: "transparent",
                borderBottom: activeTab === tab.id ? "2px solid #1B3A5C" : "2px solid transparent",
                color: activeTab === tab.id ? "#1B3A5C" : "#64748B",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "inherit",
                marginBottom: -1,
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#999", fontSize: "14px" }}>
            Loading your saves…
          </div>
        )}

        {isEmptyLibrary && (
          <div style={{ textAlign: "center", padding: "64px 24px" }}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 700, color: "#1B3A5C", marginBottom: 8 }}>What inspires you?</h2>
            <p style={{ color: "#666", fontSize: 14 }}>Paste any link and Flokk files it by city and activity. Your Saves live here.</p>
          </div>
        )}

        {hasNoResults && (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#717171", fontSize: "14px" }}>
            No saves match your search or filter.
          </div>
        )}

        {!loading && (() => {
          const sharedGrid: SharedCardGridProps = {
            openDropdown,
            setOpenDropdown,
            assignTrip,
            onCardClick: (id) => setModalItemId(id),
            availableTrips,
            onDeleted: handleItemDeleted,
            onIdentifyPlace: setIdentifyingItem,
            onRateClick: (id, title) => setRatingModal({ id, title }),
            ratedItemId,
            onShareToast: (msg) => { setSavedToast(msg); setTimeout(() => setSavedToast(null), 3000); },
          };
          return (
            <>
              {(search.trim() || activeTab === "upcoming") && (
                <UpcomingTabContent
                  sections={tabbed.upcoming}
                  expandedSections={expandedSections}
                  setExpandedSections={setExpandedSections}
                  suggestedTripMap={tabbed.suggestedTripMap}
                  onAddToTrip={handleAddToTrip}
                  onGrowTripCities={handleGrowTripCities}
                  sharedProps={sharedGrid}
                />
              )}
              {(search.trim() || activeTab === "past") && (
                <PastTabContent
                  sections={tabbed.past}
                  expandedSections={expandedSections}
                  setExpandedSections={setExpandedSections}
                  sharedProps={sharedGrid}
                />
              )}
              {(search.trim() || activeTab === "unassigned") && (
                <UnassignedTabContent
                  items={tabbed.unassigned}
                  sharedProps={sharedGrid}
                  onAssignCity={(id) => { setAssignCityItemId(id); setManualCityQuery(""); setManualCity(""); setManualCountry(""); setManualCitySuggestions([]); setManualCityShowDropdown(false); }}
                />
              )}
              {(search.trim() || activeTab === "imported") && (
                <ImportedTabContent
                  items={tabbed.imported}
                />
              )}
              {activeTab === "tours" && (
                <ToursTabContent
                  tours={savedTours}
                  search={search}
                  activeCountry={activeCountry}
                  selectedCity={selectedCity}
                  onDelete={(id) => {
                    setSavedTours(prev => {
                      const updated = { ...prev };
                      for (const city of Object.keys(updated)) {
                        updated[city] = updated[city].filter(t => t.id !== id);
                        if (updated[city].length === 0) delete updated[city];
                      }
                      return updated;
                    });
                  }}
                />
              )}
            </>
          );
        })()}

      </div>

      {/* Place identification modal */}
      {identifyingItem && (
        <div
          onClick={() => { setIdentifyingItem(null); setPlaceQuery(""); setPlaceResults([]); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "20px", width: "100%", maxWidth: "360px", padding: "24px", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
          >
            <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#1B3A5C", margin: "0 0 4px", fontFamily: '"Playfair Display", Georgia, serif', lineHeight: 1.2 }}>
              What place is this?
            </h3>
            <p style={{ fontSize: "12px", color: "#999", margin: "0 0 16px" }}>
              Type the place name and we&apos;ll find it
            </p>
            <input
              type="text"
              value={placeQuery}
              onChange={(e) => { setPlaceQuery(e.target.value); handlePlaceSearch(e.target.value); }}
              placeholder="e.g. Dragon Hill Spa Seoul"
              autoFocus
              style={{ display: "block", width: "100%", border: "1.5px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", color: "#1a1a1a", outline: "none", marginBottom: "8px", boxSizing: "border-box", fontFamily: "inherit" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#C4664A"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
            />
            {placeResults.length > 0 && (
              <div style={{ border: "1px solid #f0f0f0", borderRadius: "10px", overflow: "hidden", marginBottom: "12px" }}>
                {placeResults.map((place, i) => (
                  <button
                    key={place.place_id}
                    onClick={() => handleSelectPlace(place)}
                    disabled={identifying}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", borderBottom: i < placeResults.length - 1 ? "1px solid #f5f5f5" : "none", fontFamily: "inherit" }}
                  >
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 2px" }}>{place.name}</p>
                    <p style={{ fontSize: "11px", color: "#999", margin: 0 }}>{place.formatted_address}</p>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => { setIdentifyingItem(null); setPlaceQuery(""); setPlaceResults([]); }}
              style={{ width: "100%", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#bbb", padding: "8px 0", fontFamily: "inherit" }}
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* Save detail modal */}
      {modalItemId && (
        <SaveDetailModal
          itemId={modalItemId}
          onClose={() => setModalItemId(null)}
          onTagsUpdated={handleTagsUpdated}
          onAssigned={(itemId, trip) =>
            setSaves(prev => prev.map(s =>
              s.id === itemId ? { ...s, tripId: trip.id || null, assigned: trip.title || null } : s
            ))
          }
        />
      )}

      {/* FAB MODAL */}
      {showFabModal && (
        <div
          onClick={() => { setShowFabModal(false); setFabUrl(""); }}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              padding: "24px",
              borderRadius: "16px",
              width: "360px",
              maxWidth: "calc(100vw - 48px)",
            }}
          >
            <p
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#1a1a1a",
                marginBottom: "16px",
              }}
            >
              Save something new
            </p>
            <input
              type="url"
              value={fabUrl}
              onChange={(e) => setFabUrl(e.target.value)}
              placeholder="Paste a URL or Instagram link..."
              style={{
                display: "block",
                width: "100%",
                border: "1px solid rgba(0,0,0,0.15)",
                borderRadius: "8px",
                padding: "10px 12px",
                fontSize: "14px",
                color: "#1a1a1a",
                outline: "none",
                marginBottom: "16px",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowFabModal(false); setFabUrl(""); }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "999px",
                  border: "1px solid rgba(0,0,0,0.15)",
                  backgroundColor: "transparent",
                  color: "#717171",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowFabModal(false); setFabUrl(""); }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "999px",
                  border: "none",
                  backgroundColor: "#C4664A",
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import from Google Maps pill */}
      <button
        onClick={() => setShowImportModal(true)}
        title="Import saved places from Google Maps"
        style={{
          position: "fixed",
          bottom: 96,
          right: 164,
          height: 40,
          paddingLeft: 16,
          paddingRight: 16,
          borderRadius: 20,
          backgroundColor: "#fff",
          border: "1.5px solid #1B3A5C",
          color: "#1B3A5C",
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          zIndex: 90,
        }}
      >
        Import from Maps
      </button>

      {/* Add Activity pill button */}
      <button
        onClick={() => setShowManualModal(true)}
        title="Add activity manually"
        style={{
          position: "fixed",
          bottom: 96,
          right: 92,
          height: 40,
          paddingLeft: 16,
          paddingRight: 16,
          borderRadius: 20,
          backgroundColor: "#fff",
          border: "1.5px solid #1B3A5C",
          color: "#1B3A5C",
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          zIndex: 90,
        }}
      >
        + Add Activity
      </button>

      {/* FAB */}
      <button
        onClick={() => setShowFabModal(true)}
        title="Save something new"
        style={{
          position: "fixed",
          bottom: 88,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: "50%",
          backgroundColor: "#C4664A",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(196,102,74,0.4)",
          cursor: "pointer",
          transition: "transform 0.15s ease",
          zIndex: 90,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <Plus size={24} style={{ color: "#fff" }} />
      </button>

      {savedToast && (
        <div style={{ position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", backgroundColor: "#1B3A5C", color: "#fff", padding: "12px 20px", borderRadius: "12px", fontSize: "14px", fontWeight: 500, zIndex: 9999, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          {savedToast}
        </div>
      )}

      {/* Manual Activity Modal */}
      {showManualModal && (
        <div
          onClick={() => setShowManualModal(false)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 16 }}
          >
            <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: 20, fontWeight: 700, color: "#1B3A5C", margin: 0 }}>Add Activity</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#717171", textTransform: "uppercase", letterSpacing: "0.05em" }}>Name *</label>
              <input
                type="text"
                placeholder="e.g. TeamLab Planets"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                style={{ border: "1px solid #E8E8E8", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#0A1628", outline: "none", fontFamily: "Inter, sans-serif" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#717171", textTransform: "uppercase", letterSpacing: "0.05em" }}>Category</label>
              <select
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value)}
                style={{ border: "1px solid #E8E8E8", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#0A1628", outline: "none", fontFamily: "Inter, sans-serif", backgroundColor: "#fff" }}
              >
                {CATEGORIES.map(({ slug, label }) => (
                  <option key={slug} value={slug}>{label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, position: "relative" }} ref={manualCityDropdownRef}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#717171", textTransform: "uppercase", letterSpacing: "0.05em" }}>City</label>
              <input
                type="text"
                placeholder="e.g. Tokyo"
                value={manualCityQuery}
                onChange={(e) => { setManualCityQuery(e.target.value); setManualCity(e.target.value); setManualRegion(""); setManualCountry(""); }}
                onFocus={() => { if (manualCitySuggestions.length > 0) setManualCityShowDropdown(true); }}
                style={{ border: "1px solid #E8E8E8", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#0A1628", outline: "none", fontFamily: "Inter, sans-serif" }}
              />
              {manualCityShowDropdown && manualCitySuggestions.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "#fff", border: "1px solid #E8E8E8", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", overflow: "hidden", marginTop: 4 }}>
                  {manualCitySuggestions.map((s) => (
                    <div
                      key={s.placeId}
                      onMouseDown={() => selectManualCity(s.cityName, s.countryName, s.region ?? "")}
                      style={{ padding: "10px 12px", fontSize: 14, color: "#0A1628", cursor: "pointer", borderBottom: "1px solid #F5F5F5", fontFamily: "Inter, sans-serif" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#F9F5F3"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
                    >
                      <span style={{ fontWeight: 600 }}>{s.cityName}{s.region && s.region !== s.countryName ? `, ${s.region}` : ""}</span>
                      {s.countryName && <span style={{ color: "#717171", marginLeft: 6 }}>{s.countryName}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#717171", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes</label>
              <textarea
                placeholder="Any notes..."
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                rows={3}
                style={{ border: "1px solid #E8E8E8", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#0A1628", outline: "none", fontFamily: "Inter, sans-serif", resize: "vertical" }}
              />
            </div>

            {manualCategory === "food_and_drink" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#666", letterSpacing: "0.05em", textTransform: "uppercase" }}>Dietary</label>
                <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !manualIsVegetarian;
                      setManualIsVegetarian(next);
                      if (!next) setManualIsVegan(false);
                    }}
                    style={{ padding: "6px 14px", borderRadius: "999px", border: "1px solid #16a34a", background: manualIsVegetarian ? "#16a34a" : "white", color: manualIsVegetarian ? "white" : "#16a34a", fontSize: "13px", cursor: "pointer" }}
                  >Vegetarian</button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !manualIsVegan;
                      setManualIsVegan(next);
                      if (next) setManualIsVegetarian(true);
                    }}
                    style={{ padding: "6px 14px", borderRadius: "999px", border: "1px solid #16a34a", background: manualIsVegan ? "#16a34a" : "white", color: manualIsVegan ? "white" : "#16a34a", fontSize: "13px", cursor: "pointer" }}
                  >Vegan</button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#717171", textTransform: "uppercase", letterSpacing: "0.05em" }}>Website</label>
              <input
                type="url"
                placeholder="https://"
                value={manualWebsite}
                onChange={(e) => setManualWebsite(e.target.value)}
                style={{ border: "1px solid #E8E8E8", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#0A1628", outline: "none", fontFamily: "Inter, sans-serif" }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <button
                onClick={() => { setShowManualModal(false); setManualIsVegetarian(false); setManualIsVegan(false); }}
                style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: "1px solid #E8E8E8", backgroundColor: "#fff", color: "#717171", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={handleManualSave}
                disabled={!manualName.trim() || manualSubmitting}
                style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: "none", backgroundColor: manualName.trim() ? "#C4664A" : "#E8E8E8", color: manualName.trim() ? "#fff" : "#aaa", fontSize: 14, fontWeight: 600, cursor: manualName.trim() ? "pointer" : "default", fontFamily: "Inter, sans-serif" }}
              >
                {manualSubmitting ? "Saving..." : "Save Activity"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add-to-trip picker — when save matches multiple upcoming trips */}
      {addToTripModal && (
        <div
          onClick={() => setAddToTripModal(null)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "20px", width: "100%", maxWidth: "320px", padding: "24px", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", margin: 0, fontFamily: '"Playfair Display", Georgia, serif' }}>
              Add to which trip?
            </h3>
            {addToTripModal.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => doAssignToTrip(addToTripModal.saveId, opt.id, opt.name)}
                style={{ width: "100%", padding: "12px 16px", border: "1px solid #E5E7EB", borderRadius: "8px", background: "white", color: "#1B3A5C", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F9F5F3"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "white"; }}
              >
                {opt.name}
              </button>
            ))}
            <button
              onClick={() => setAddToTripModal(null)}
              style={{ padding: "10px 0", border: "none", background: "transparent", color: "#6B7280", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Assign city modal */}
      {assignCityItemId && (
        <div
          onClick={() => { setAssignCityItemId(null); setManualCityQuery(""); setManualCitySuggestions([]); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "20px", width: "100%", maxWidth: "360px", padding: "24px", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#1B3A5C", margin: 0, fontFamily: '"Playfair Display", Georgia, serif', lineHeight: 1.2 }}>
              Assign a location
            </h3>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={manualCityQuery}
                onChange={(e) => { setManualCityQuery(e.target.value); setManualCity(e.target.value); setManualCountry(""); }}
                placeholder="e.g. Tokyo"
                autoFocus
                style={{ display: "block", width: "100%", border: "1.5px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", color: "#1a1a1a", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#C4664A"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
              />
              {manualCityShowDropdown && manualCitySuggestions.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "#fff", border: "1px solid #E8E8E8", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", overflow: "hidden", marginTop: 4 }}>
                  {manualCitySuggestions.map((s) => (
                    <div
                      key={s.placeId}
                      onMouseDown={() => selectManualCity(s.cityName, s.countryName, s.region ?? "")}
                      style={{ padding: "10px 12px", fontSize: 14, color: "#0A1628", cursor: "pointer", borderBottom: "1px solid #F5F5F5", fontFamily: "Inter, sans-serif" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#F9F5F3"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
                    >
                      <span style={{ fontWeight: 600 }}>{s.cityName}{s.region && s.region !== s.countryName ? `, ${s.region}` : ""}</span>
                      {s.countryName && <span style={{ color: "#717171", marginLeft: 6 }}>{s.countryName}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => { setAssignCityItemId(null); setManualCityQuery(""); setManualCitySuggestions([]); }}
                style={{ flex: 1, padding: "10px 0", borderRadius: "8px", border: "1px solid #E8E8E8", backgroundColor: "#fff", color: "#717171", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                disabled={!manualCity.trim()}
                onClick={() => handleAssignCity(manualCity.trim(), manualCountry)}
                style={{ flex: 1, padding: "10px 0", borderRadius: "8px", border: "none", backgroundColor: manualCity.trim() ? "#C4664A" : "#E8E8E8", color: manualCity.trim() ? "#fff" : "#aaa", fontSize: "14px", fontWeight: 600, cursor: manualCity.trim() ? "pointer" : "default", fontFamily: "inherit" }}
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RATING MODAL */}
      {ratingModal && (
        <RatingModal
          itemId={ratingModal.id}
          title={ratingModal.title}
          onClose={() => setRatingModal(null)}
          onRated={(id, value) => {
            setRatedItemId(id);
            setSaves((prev) => prev.map((s) => s.id === id ? { ...s, userRating: value } : s));
            setSavedToast("Rating saved!");
            setTimeout(() => setSavedToast(null), 3000);
          }}
        />
      )}

      {/* Import from Maps modal */}
      {showImportModal && (
        <ImportMapsModal
          onClose={() => setShowImportModal(false)}
          onImported={async () => {
            const fresh = await fetch("/api/saves").then(r => r.json());
            setSaves((fresh.saves ?? []).map(mapApiItem));
          }}
        />
      )}

    </div>
  );
}
