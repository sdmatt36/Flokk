"use client";

import Link from "next/link";
import { SpotImage } from "@/components/shared/SpotImage";
import { PlaceActionRow } from "@/components/features/places/PlaceActionRow";
import { EntityStatusPill } from "@/components/ui/EntityStatusPill";
import { resolveSaveLink } from "@/lib/save-link";
import type { EntityStatusResult } from "@/lib/entity-status";

export interface CommunitySpotCardSpot {
  id: string;
  title: string;
  city: string | null;
  photoUrl: string | null;
  category: string | null;
  rating: number | null;
  ratingCount: number;
  description: string | null;
  websiteUrl?: string | null;
  sourceUrl?: string | null;
  communitySpotWebsiteUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  contributorName?: string | null;
  shareToken?: string | null;
}

export interface CommunitySpotCardProps {
  spot: CommunitySpotCardSpot;
  isSaved?: boolean;
  saveStatus?: EntityStatusResult | null;
  userRating?: number | null;
  /** When omitted, the card renders in view-only mode: no PlaceActionRow. */
  onFlokkIt?: () => Promise<void> | void;
  onClickCard?: () => void;
  onShareToast?: (msg: string) => void;
  showAddToItinerary?: boolean;
  /** When provided, the card renders as a Next.js Link instead of using onClickCard. */
  href?: string;
}

export function CommunitySpotCard({
  spot,
  isSaved = false,
  saveStatus = null,
  userRating = null,
  onFlokkIt,
  onClickCard,
  onShareToast,
  showAddToItinerary = true,
  href,
}: CommunitySpotCardProps) {
  const resolvedWebsiteUrl = resolveSaveLink({
    websiteUrl: spot.websiteUrl ?? null,
    sourceUrl: spot.sourceUrl ?? null,
    communitySpotWebsiteUrl: spot.communitySpotWebsiteUrl ?? null,
    lat: spot.lat ?? null,
    lng: spot.lng ?? null,
    rawTitle: spot.title,
    destinationCity: spot.city,
  })?.url ?? null;

  const CardWrapper = href
    ? ({ children }: { children: React.ReactNode }) => (
        <Link href={href} style={{ textDecoration: "none", display: "flex", flexDirection: "column", flex: 1 }}>
          {children}
        </Link>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <div onClick={onClickCard} style={{ display: "flex", flexDirection: "column", flex: 1, cursor: onClickCard ? "pointer" : "default" }}>
          {children}
        </div>
      );

  return (
    <div
      style={{
        backgroundColor: "#fff", borderRadius: "16px", overflow: "hidden",
        border: "1px solid #EEEEEE", boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
        display: "flex", flexDirection: "column",
      }}
    >
      <CardWrapper>
        <div style={{ height: "160px", backgroundColor: "#1B3A5C1A", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
          <SpotImage
            spotId={spot.id}
            src={spot.photoUrl}
            category={spot.category}
            alt={spot.title}
            allowResolve={true}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {spot.rating !== null && spot.rating >= 3 && (
            <span className="absolute bottom-3 left-3 bg-[#C4664A] text-white text-xs px-2 py-1 rounded-full font-medium">
              Flokk Approved
            </span>
          )}
        </div>
        <div style={{ padding: "14px 16px 0", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: "11px", color: "#AAAAAA", marginBottom: "3px" }}>{spot.city ?? ""}</p>
          <p style={{ fontSize: "14px", fontWeight: 600, color: "#1B3A5C", marginBottom: "4px", lineHeight: 1.3 }}>{spot.title}</p>
          {saveStatus && saveStatus.status !== "saved" && (
            <div style={{ marginBottom: "6px" }}>
              <EntityStatusPill status={saveStatus.status} label={saveStatus.label} color={saveStatus.color} />
            </div>
          )}
          {spot.description && (
            <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.5, marginBottom: "6px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{spot.description}</p>
          )}
          {spot.rating !== null && spot.ratingCount >= 2 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
              <span style={{ color: "#f59e0b", fontSize: "13px", letterSpacing: "1px" }}>
                {"★".repeat(spot.rating)}{"☆".repeat(5 - spot.rating)}
              </span>
              <span style={{ fontSize: "11px", color: "#AAAAAA" }}>
                {spot.ratingCount} families rated this
              </span>
            </div>
          ) : spot.ratingCount === 1 ? (
            <p style={{ fontSize: "11px", color: "#CCCCCC", marginBottom: "4px" }}>1 family rated this</p>
          ) : null}
        </div>
      </CardWrapper>
      {onFlokkIt && (
        <div style={{ padding: "0 16px 14px", marginTop: "auto" }} onClick={(e) => e.stopPropagation()}>
          <PlaceActionRow
            place={{
              name: spot.title,
              city: spot.city,
              websiteUrl: resolvedWebsiteUrl,
              photoUrl: spot.photoUrl,
              category: spot.category,
              shareUrl: spot.shareToken ? `/spots/${spot.shareToken}` : undefined,
            }}
            isSaved={isSaved}
            showAddToItinerary={showAddToItinerary && (!saveStatus || saveStatus.showAffordance)}
            userRating={userRating}
            onFlokkIt={onFlokkIt}
            onShareToast={onShareToast}
            variant="card-compact"
          />
        </div>
      )}
    </div>
  );
}
