"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";

export type SerializableItem = {
  id: string;
  kind: "save" | "itinerary";
  title: string;
  subtitle: string | null;
  tag: string | null;
  tagBg: string;
  tagColor: string;
  notes: string | null;
  imageUrl: string | null;
  rating: { rating: number; notes: string | null; wouldReturn: boolean | null } | null;
  lat: number | null;
  lng: number | null;
  destinationCity: string | null;
  saveable: boolean;
  websiteUrl: string | null;
};

export function ShareActivityCard({
  item,
  isLoggedIn,
  heroImageUrl,
}: {
  item: SerializableItem;
  isLoggedIn: boolean;
  heroImageUrl?: string | null;
}) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "duplicate">("idle");
  const [imgFailed, setImgFailed] = useState(false);
  const pathname = usePathname();

  // Use only the item's own image — do not fall back to heroImageUrl (trip cover photo)
  // Items without a specific photo get the clean stone-100 placeholder
  const imgSrc = item.imageUrl ?? null;
  const hasImage = !!imgSrc && !imgFailed;

  async function handleSave() {
    if (!isLoggedIn) {
      window.location.href = `/sign-up?redirect_url=${encodeURIComponent(pathname ?? "")}`;
      return;
    }
    setSaveState("saving");
    try {
      const res = await fetch("/api/saves/from-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          city: item.destinationCity,
          lat: item.lat,
          lng: item.lng,
          placePhotoUrl: item.imageUrl ?? null,
          websiteUrl: item.websiteUrl,
        }),
      });
      const data = await res.json() as { saved?: boolean; duplicate?: boolean };
      if (data.duplicate) {
        setSaveState("duplicate");
      } else if (res.status === 200 || res.status === 201) {
        setSaveState("saved");
      } else {
        setSaveState("idle");
      }
    } catch {
      setSaveState("idle");
    }
  }

  return (
    <div className="rounded-xl overflow-hidden shadow-sm bg-white border border-stone-100 w-full">
      {/* Full-width image */}
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc!}
          alt={item.title}
          className="w-full h-48 object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="w-full h-48 bg-stone-100 flex items-center justify-center">
          {item.tag && (
            <span
              style={{ backgroundColor: item.tagBg, color: item.tagColor }}
              className="text-xs font-bold px-2 py-1 rounded"
            >
              {item.tag.toUpperCase()}
            </span>
          )}
        </div>
      )}

      {/* Card body */}
      <div className="p-4">
        {/* Tag pill (only when image is shown — visual context already in placeholder otherwise) */}
        {hasImage && item.tag && (
          <span
            style={{ backgroundColor: item.tagBg, color: item.tagColor }}
            className="inline-block text-[9px] font-black rounded px-1 py-0.5 tracking-wide mb-2"
          >
            {item.tag.toUpperCase()}
          </span>
        )}

        {/* Name */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-[#1B3A5C] text-base leading-snug">
            {item.title}
          </h3>
          {item.rating && (
            <span className="text-[#C4664A] text-sm whitespace-nowrap flex-shrink-0">
              {"★".repeat(Math.max(0, Math.min(5, item.rating.rating)))}
            </span>
          )}
        </div>

        {/* Subtitle */}
        {item.subtitle && (
          <p className="text-xs text-stone-400 mt-0.5">{item.subtitle}</p>
        )}

        {/* Would return label */}
        {item.rating?.wouldReturn !== null && item.rating?.wouldReturn !== undefined && (
          <p
            className="text-xs mt-0.5 font-medium"
            style={{ color: item.rating.wouldReturn ? "#6B8F71" : "#AAAAAA" }}
          >
            {item.rating.wouldReturn ? "Would return" : "Wouldn't return"}
          </p>
        )}

        {/* Description / notes */}
        {item.notes && (
          <p
            className="text-sm text-stone-500 mt-2"
            style={{
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            } as React.CSSProperties}
          >
            {item.notes}
          </p>
        )}

        {/* Rating notes */}
        {item.rating?.notes && (
          <p
            className="text-xs text-stone-400 italic mt-1"
            style={{
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            } as React.CSSProperties}
          >
            {item.rating.notes}
          </p>
        )}

        {/* Visit site link */}
        {item.websiteUrl && (
          <a
            href={item.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-[#C4664A] mt-2"
          >
            <ExternalLink size={14} />
            Visit site
          </a>
        )}

        {/* Flokk It save button */}
        {item.saveable && (
          <div className="mt-3">
            <button
              onClick={handleSave}
              disabled={saveState === "saving" || saveState === "saved" || saveState === "duplicate"}
              className="w-full font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-white"
              style={{
                backgroundColor:
                  saveState === "saved"
                    ? "#6B8F71"
                    : saveState === "duplicate"
                    ? "#AAAAAA"
                    : "#C4664A",
              }}
            >
              {saveState === "saved"
                ? "Flokked"
                : saveState === "duplicate"
                ? "Already saved"
                : saveState === "saving"
                ? "Flokking..."
                : "Flokk It"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
