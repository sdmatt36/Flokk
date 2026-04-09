"use client";
import { useState } from "react";

interface SaveableItem {
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
    console.log("[SaveDayButton] clicked, isLoggedIn:", isLoggedIn, "items:", items.length);
    if (!isLoggedIn) {
      window.location.href = `/sign-up?redirect_url=${encodeURIComponent(currentPath)}`;
      return;
    }
    setState("saving");
    let count = 0;
    for (const item of items) {
      try {
        console.log("[SaveDayButton] saving:", item.title);
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
        console.log("[SaveDayButton] response for", item.title, ":", data);
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
      disabled={state === "saving"}
      style={{
        fontSize: "12px",
        fontWeight: 600,
        color: state === "done" ? "#1B3A5C" : state === "saving" ? "#999" : "#C4664A",
        background: "none",
        border: "1px solid",
        borderColor: state === "done" ? "#1B3A5C" : state === "saving" ? "#DDD" : "#C4664A",
        borderRadius: "20px",
        padding: "4px 12px",
        cursor: state === "saving" ? "default" : "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {state === "done"
        ? `${savedCount} ${savedCount === 1 ? "place" : "places"} saved`
        : state === "saving"
        ? "Saving..."
        : `Save day (${items.length})`}
    </button>
  );
}
