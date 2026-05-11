"use client";

import { useState, useMemo, useEffect } from "react";
import { Playfair_Display } from "next/font/google";
import { QuickAddModal } from "@/components/shared/QuickAddModal";
import { useUser } from "@clerk/nextjs";
import { CommunitySpotCard } from "@/components/shared/cards/CommunitySpotCard";
import { ItemDetailModal } from "@/components/shared/ItemDetailModal";
import { AddToItineraryProvider } from "@/components/features/places/AddToItineraryProvider";
import { buildSaveStatusMap } from "@/lib/save-status-map";
import type { EntityStatusResult } from "@/lib/entity-status";
import { CATEGORIES } from "@/lib/categories";
import { CategoryFilterChips } from "@/components/shared/CategoryFilterChips";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"] });

const GRID_CSS = `
  .spot-section-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  @media (max-width: 900px) {
    .spot-section-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 500px) {
    .spot-section-grid { grid-template-columns: 1fr; }
  }
`;

type SortKey = "top-rated" | "most-rated";
type FilterField = "category" | "cuisine" | "lodgingType";

export interface CitySpot {
  id: string;
  name: string;
  category: string | null;
  cuisine?: string | null;
  lodgingType?: string | null;
  photoUrl: string | null;
  averageRating: number | null;
  ratingCount: number;
  description: string | null;
  websiteUrl?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  googlePlaceId?: string | null;
  contributorName?: string | null;
}

interface SpotSectionProps {
  id: string;
  title: string;
  spots: CitySpot[];
  cityName: string;
  addHref?: string;
  emptyText: string;
  filterField?: FilterField;
}

function formatFilterLabel(value: string, field: FilterField): string {
  if (field === "category") {
    return CATEGORIES.find((c) => c.slug === value)?.label ?? value.replace(/_/g, " ");
  }
  return value;
}

export function SpotSection({
  id,
  title,
  spots,
  cityName,
  addHref = "/discover/spots",
  emptyText,
  filterField = "category",
}: SpotSectionProps) {
  const { isSignedIn } = useUser();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("top-rated");
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [openSpot, setOpenSpot] = useState<CitySpot | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [userSaveStatusMap, setUserSaveStatusMap] = useState<Map<string, EntityStatusResult>>(new Map());
  const [userSpotRatings, setUserSpotRatings] = useState<Map<string, number>>(new Map());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [shareToast, setShareToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/saves")
      .then(r => r.json())
      .then((d: { saves?: unknown[] }) => {
        if (!Array.isArray(d.saves)) return;
        setUserSaveStatusMap(buildSaveStatusMap(d.saves as Parameters<typeof buildSaveStatusMap>[0]));
      })
      .catch(() => {});
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/community/user-ratings")
      .then(r => r.json())
      .then((d: { ratings?: Array<{ spotName: string; spotCity: string | null; rating: number | null }> }) => {
        const map = new Map<string, number>();
        (d.ratings ?? []).forEach((r) => {
          if (r.rating != null) {
            map.set(`${r.spotName.toLowerCase().trim()}|${(r.spotCity ?? "").toLowerCase().trim()}`, r.rating);
          }
        });
        setUserSpotRatings(map);
      })
      .catch(() => {});
  }, [isSignedIn]);

  const uniqueValues = useMemo(() => {
    const seen = new Map<string, number>();
    for (const s of spots) {
      const v = (s as unknown as Record<string, unknown>)[filterField] as string | null | undefined;
      if (v) seen.set(v, (seen.get(v) ?? 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }, [spots, filterField]);

  const showChips = uniqueValues.length >= 2;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return spots.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q)) return false;
      if (selectedFilter !== null && (s as unknown as Record<string, unknown>)[filterField] !== selectedFilter) return false;
      return true;
    });
  }, [spots, selectedFilter, filterField, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      sort === "top-rated"
        ? (b.averageRating ?? 0) - (a.averageRating ?? 0)
        : b.ratingCount - a.ratingCount
    );
  }, [filtered, sort]);

  const visible = expanded ? sorted : sorted.slice(0, 8);
  const hiddenCount = sorted.length - 8;

  return (
    <AddToItineraryProvider>
      <section id={id} style={{ paddingTop: "48px", paddingBottom: "8px", scrollMarginTop: "108px" }}>
        <style>{GRID_CSS}</style>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
            <h2
              className={playfair.className}
              style={{ fontSize: "22px", fontWeight: 700, color: "#1B3A5C", margin: 0 }}
            >
              {title}
            </h2>
            {spots.length > 0 && (
              <span style={{
                fontSize: "12px", fontWeight: 600, color: "#C4664A",
                backgroundColor: "#FFF3EE", borderRadius: "20px", padding: "2px 10px",
              }}>
                {spots.length}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
            {spots.length > 0 && (
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value as SortKey); setExpanded(false); }}
                style={{
                  fontSize: "12px", color: "#666",
                  border: "1px solid #E5E7EB", borderRadius: "8px",
                  padding: "3px 8px", cursor: "pointer", background: "#fff",
                }}
              >
                <option value="top-rated">Top rated</option>
                <option value="most-rated">Most rated</option>
              </select>
            )}
            <button
              onClick={() => setAddModalOpen(true)}
              style={{ fontSize: "13px", fontWeight: 600, color: "#C4664A", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
            >
              + Pick
            </button>
          </div>
        </div>

        {/* Search input */}
        {spots.length > 0 && (
          <div style={{ marginBottom: "10px" }}>
            <input
              type="text"
              placeholder={`Search ${title.toLowerCase()}...`}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setExpanded(false); }}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: "8px",
                border: "1px solid #E5E7EB", fontSize: "13px", color: "#1a1a1a",
                outline: "none", fontFamily: "inherit", backgroundColor: "#fff",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {spots.length === 0 ? (
          <div style={{
            padding: "32px 24px", backgroundColor: "#FAFAFA",
            borderRadius: "12px", border: "1px dashed #E5E7EB",
            textAlign: "center",
          }}>
            <p style={{ fontSize: "14px", color: "#9CA3AF", margin: 0 }}>{emptyText}</p>
          </div>
        ) : (
          <>
            {showChips && (
              <div style={{ marginBottom: "12px" }}>
                <CategoryFilterChips
                  selected={selectedFilter}
                  available={uniqueValues.map(([value, count]) => ({
                    slug: value,
                    label: formatFilterLabel(value, filterField),
                    count,
                  }))}
                  onSelect={(s) => { setSelectedFilter(s); setExpanded(false); }}
                />
              </div>
            )}

            {visible.length === 0 && (
              <div style={{ padding: "24px", textAlign: "center", color: "#9CA3AF", fontSize: "14px" }}>
                No spots match your search.
              </div>
            )}
            <div className="spot-section-grid">
              {visible.map((spot) => {
                const spotKey = `${spot.name.toLowerCase().trim()}|${cityName.toLowerCase().trim()}`;
                const saveStatus = userSaveStatusMap.get(spotKey) ?? null;
                const isSaved = savedIds.has(spot.id) || (!!saveStatus && saveStatus.status !== "saved");
                const userRating = userSpotRatings.get(spotKey) ?? null;
                const rating = spot.averageRating !== null ? Math.round(spot.averageRating) : null;
                return (
                  <CommunitySpotCard
                    key={spot.id}
                    spot={{
                      id: spot.id,
                      title: spot.name,
                      city: cityName,
                      photoUrl: spot.photoUrl,
                      category: spot.category,
                      rating,
                      ratingCount: spot.ratingCount,
                      description: spot.description,
                      websiteUrl: spot.websiteUrl ?? null,
                      lat: spot.lat ?? null,
                      lng: spot.lng ?? null,
                    }}
                    isSaved={isSaved}
                    saveStatus={saveStatus}
                    userRating={userRating}
                    onClickCard={() => setOpenSpot(spot)}
                    onFlokkIt={async () => {
                      try {
                        await fetch("/api/saves/from-share", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            title: spot.name,
                            city: cityName,
                            placePhotoUrl: spot.photoUrl ?? "",
                            websiteUrl: spot.websiteUrl ?? "",
                            tripId: null,
                          }),
                        });
                        setSavedIds((prev) => new Set(prev).add(spot.id));
                      } catch {}
                    }}
                    onShareToast={(msg) => { setShareToast(msg); setTimeout(() => setShareToast(null), 3000); }}
                    showAddToItinerary={!!isSignedIn}
                  />
                );
              })}
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

        {openSpot && (() => {
          const panelKey = `${openSpot.name.toLowerCase().trim()}|${cityName.toLowerCase().trim()}`;
          const panelStatus = userSaveStatusMap.get(panelKey) ?? null;
          const panelSaved = savedIds.has(openSpot.id) || (!!panelStatus && panelStatus.status !== "saved");
          return (
            <ItemDetailModal
              entityType="CommunitySpot"
              id={openSpot.id}
              open={true}
              onClose={() => setOpenSpot(null)}
              initialIsSaved={panelSaved}
              onSaved={(id) => setSavedIds((prev) => new Set(prev).add(id))}
              onShareToast={(msg) => { setShareToast(msg); setTimeout(() => setShareToast(null), 3000); }}
              showAddToItinerary={!!isSignedIn}
            />
          );
        })()}

        {shareToast && (
          <div style={{
            position: "fixed", bottom: 88, left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#1B3A5C", color: "#fff",
            padding: "10px 20px", borderRadius: 999,
            fontSize: 13, fontWeight: 600, zIndex: 1300,
            pointerEvents: "none", whiteSpace: "nowrap",
          }}>
            {shareToast}
          </div>
        )}
      </section>

      <QuickAddModal
        isOpen={addModalOpen}
        defaultTab="pick"
        prefillCity={cityName}
        onClose={() => setAddModalOpen(false)}
      />
    </AddToItineraryProvider>
  );
}
