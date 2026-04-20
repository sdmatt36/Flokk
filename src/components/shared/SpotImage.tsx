"use client";

import { useState, useEffect } from "react";

const CATEGORY_FALLBACK: Record<string, string> = {
  Food: "/images/fallbacks/food.svg",
  food_and_drink: "/images/fallbacks/food.svg",
  Culture: "/images/fallbacks/culture.svg",
  Outdoor: "/images/fallbacks/outdoor.svg",
  Shopping: "/images/fallbacks/shopping.svg",
  shopping: "/images/fallbacks/shopping.svg",
  Lodging: "/images/fallbacks/lodging.svg",
  Activity: "/images/fallbacks/activity.svg",
  experiences: "/images/fallbacks/activity.svg",
  Other: "/images/fallbacks/other.svg",
};

interface SpotImageProps {
  spotId?: string;
  src?: string | null;
  category?: string | null;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  allowResolve?: boolean;
}

export function SpotImage({
  spotId, src, category, alt, className, style, allowResolve = true,
}: SpotImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string | null>(src ?? null);
  const [errored, setErrored] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [retriedSrc, setRetriedSrc] = useState<string | null>(null);

  useEffect(() => {
    setCurrentSrc(src ?? null);
    setErrored(false);
    setRetriedSrc(null);
  }, [src, spotId]);

  // Lazy backfill: if no src and we have a spotId, try resolve-image once
  useEffect(() => {
    if (!allowResolve || currentSrc || !spotId || resolving || errored) return;
    setResolving(true);
    fetch(`/api/community-spots/${spotId}/resolve-image`, { method: "POST" })
      .then(r => r.ok ? r.json() : null)
      .then((data: { photoUrl?: string | null } | null) => {
        if (data?.photoUrl) setCurrentSrc(data.photoUrl);
        else setErrored(true);
      })
      .catch(() => setErrored(true))
      .finally(() => setResolving(false));
  }, [spotId, currentSrc, resolving, errored, allowResolve]);

  const fallbackSrc = category && CATEGORY_FALLBACK[category]
    ? CATEGORY_FALLBACK[category]
    : "/images/fallbacks/other.svg";
  const finalSrc = errored || !currentSrc ? fallbackSrc : currentSrc;

  async function handleError() {
    if (spotId && currentSrc && retriedSrc !== currentSrc) {
      setRetriedSrc(currentSrc);
      try {
        const res = await fetch(
          `/api/community-spots/${spotId}/resolve-image?forceRefresh=true`,
          { method: "POST" }
        );
        if (res.ok) {
          const data = await res.json() as { photoUrl?: string | null };
          if (data.photoUrl && data.photoUrl !== currentSrc) {
            setCurrentSrc(data.photoUrl);
            setErrored(false);
            return;
          }
        }
      } catch {
        // fall through to SVG fallback
      }
    }
    setErrored(true);
  }

  return (
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      style={style}
      onError={handleError}
      loading="lazy"
    />
  );
}
