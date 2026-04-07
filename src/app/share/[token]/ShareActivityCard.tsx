"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "duplicate" | "error">("idle");
  const [imgFailed, setImgFailed] = useState(false);
  const pathname = usePathname();

  const imgSrc = item.imageUrl ?? heroImageUrl ?? null;

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
          websiteUrl: null,
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
    <div className="bg-white rounded-xl shadow-sm border-l-4 border-[#C4664A] p-4 mb-3 flex gap-3 items-start">
      {(imgSrc && !imgFailed) ? (
        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={item.title}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        </div>
      ) : (
        <div className="w-16 h-16 rounded-lg bg-[#F5EDE8] flex-shrink-0 flex items-center justify-center">
          <span className="text-[#C4664A] text-xs font-medium">
            {item.tag ?? "ACT"}
          </span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          <div className="flex-1 min-w-0">
            {item.tag && (
              <span
                style={{ backgroundColor: item.tagBg, color: item.tagColor }}
                className="inline-block text-[9px] font-black rounded px-1 py-0.5 tracking-wide mb-1"
              >
                {item.tag.toUpperCase()}
              </span>
            )}
            <p className="text-sm font-bold text-[#1B3A5C] leading-snug m-0">
              {item.title}
            </p>
            {item.subtitle && (
              <p className="text-xs text-[#888] mt-0.5 m-0">{item.subtitle}</p>
            )}
          </div>
        </div>

        {item.notes && (
          <div className="mt-2">
            <p
              className="text-xs text-[#888] italic leading-snug m-0"
              style={{
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              } as React.CSSProperties}
            >
              {item.notes}
            </p>
          </div>
        )}

        {item.rating && (
          <div className="mt-2 pt-2 border-t border-[#F0F0F0]">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#C4664A] tracking-wide">
                {"★".repeat(Math.max(0, Math.min(5, item.rating.rating)))}
                {"☆".repeat(Math.max(0, 5 - item.rating.rating))}
              </span>
              {item.rating.wouldReturn !== null && (
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: item.rating.wouldReturn ? "#6B8F71" : "#AAAAAA" }}
                >
                  {item.rating.wouldReturn ? "Would return" : "Wouldn't return"}
                </span>
              )}
            </div>
            {item.rating.notes && (
              <p className="text-xs text-[#666] italic mt-1 leading-snug m-0">
                {item.rating.notes}
              </p>
            )}
          </div>
        )}

        {item.saveable && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saveState === "saving" || saveState === "saved" || saveState === "duplicate"}
              style={{
                fontSize: "12px",
                border: saveState === "saved" || saveState === "duplicate" ? "none" : "1px solid #C4664A",
                color: saveState === "saved" ? "#6B8F71" : saveState === "duplicate" ? "#AAAAAA" : "#C4664A",
                backgroundColor: "transparent",
                padding: "5px 12px",
                borderRadius: "999px",
                cursor: saveState === "saving" || saveState === "saved" || saveState === "duplicate" ? "default" : "pointer",
                fontFamily: "inherit",
                fontWeight: 600,
                transition: "all 0.15s",
              }}
            >
              {saveState === "saved"
                ? "Saved to your library"
                : saveState === "duplicate"
                ? "Already saved"
                : saveState === "saving"
                ? "Saving..."
                : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
