"use client";
import { useState } from "react";

export interface SaveableItem {
  id: string;
  title: string;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
  destinationCity: string | null;
}

interface SaveDayButtonProps {
  items: SaveableItem[];
  isLoggedIn: boolean;
  currentPath: string;
}

export function SaveDayButton({ items, isLoggedIn, currentPath }: SaveDayButtonProps) {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [savedCount, setSavedCount] = useState(0);

  if (items.length === 0) return null;

  async function handleSaveDay() {
    if (!isLoggedIn) {
      window.location.href = `/sign-up?redirect_url=${encodeURIComponent(currentPath)}`;
      return;
    }
    setState("saving");
    let count = 0;
    for (const item of items) {
      try {
        const res = await fetch("/api/saves/from-share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            city: item.destinationCity,
            lat: item.lat,
            lng: item.lng,
            placePhotoUrl: item.imageUrl,
          }),
        });
        const data = await res.json();
        if (data.saved) count++;
      } catch (err) {
        console.error("[SaveDayButton] fetch error for", item.title, ":", err);
      }
    }
    setSavedCount(count);
    setState("done");
  }

  return (
    <button
      onClick={handleSaveDay}
      disabled={state === "saving" || state === "done"}
      style={{
        fontSize: "12px",
        fontWeight: 600,
        color: state === "done" ? "#fff" : state === "saving" ? "#fff" : "#fff",
        background: state === "done" ? "#6B8F71" : state === "saving" ? "#D0956E" : "#C4664A",
        border: "none",
        borderRadius: "20px",
        padding: "4px 14px",
        cursor: state === "saving" || state === "done" ? "default" : "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {state === "done"
        ? `Flokked ${savedCount > 0 ? `(${savedCount})` : ""}`
        : state === "saving"
        ? "Flokking..."
        : "Flokk It"}
    </button>
  );
}
