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
}: {
  item: SerializableItem;
  isLoggedIn: boolean;
}) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const pathname = usePathname();

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
          description: item.notes,
          thumbnailUrl: item.imageUrl,
          lat: item.lat,
          lng: item.lng,
          destinationCity: item.destinationCity,
        }),
      });
      if (res.status === 200 || res.status === 201) {
        setSaveState("saved");
      } else {
        throw new Error("Failed");
      }
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
    }
  }

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: "10px",
        borderLeft: "4px solid #C4664A",
        boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            style={{ width: "60px", height: "60px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {item.tag && (
            <span
              style={{
                display: "inline-block",
                fontSize: "9px",
                fontWeight: 800,
                color: item.tagColor,
                backgroundColor: item.tagBg,
                borderRadius: "4px",
                padding: "2px 5px",
                letterSpacing: "0.05em",
                marginBottom: "3px",
              }}
            >
              {item.tag.toUpperCase()}
            </span>
          )}
          <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, margin: 0 }}>
            {item.title}
          </p>
          {item.subtitle && (
            <p style={{ fontSize: "12px", color: "#888", marginTop: "2px" }}>{item.subtitle}</p>
          )}
          {item.notes && (
            <p
              style={{
                fontSize: "12px",
                color: "#888",
                fontStyle: "italic",
                marginTop: "3px",
                lineHeight: 1.4,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              } as React.CSSProperties}
            >
              {item.notes}
            </p>
          )}
        </div>
      </div>

      {item.rating && (
        <div style={{ borderTop: "1px solid #F0F0F0", paddingTop: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", color: "#C4664A", letterSpacing: "0.05em" }}>
              {"★".repeat(Math.max(0, Math.min(5, item.rating.rating)))}
              {"☆".repeat(Math.max(0, 5 - item.rating.rating))}
            </span>
            {item.rating.wouldReturn !== null && (
              <span style={{ fontSize: "11px", fontWeight: 600, color: item.rating.wouldReturn ? "#6B8F71" : "#AAAAAA" }}>
                {item.rating.wouldReturn ? "Would return" : "Wouldn't return"}
              </span>
            )}
          </div>
          {item.rating.notes && (
            <p style={{ fontSize: "12px", color: "#666", fontStyle: "italic", marginTop: "4px", lineHeight: 1.4 }}>
              {item.rating.notes}
            </p>
          )}
        </div>
      )}

      {item.saveable && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleSave}
            disabled={saveState === "saving" || saveState === "saved"}
            style={{
              fontSize: "12px",
              border: `1px solid ${saveState === "saved" ? "#6B8F71" : "#C4664A"}`,
              color: saveState === "saved" ? "#6B8F71" : "#C4664A",
              backgroundColor: "transparent",
              padding: "5px 12px",
              borderRadius: "999px",
              cursor: saveState === "saving" || saveState === "saved" ? "default" : "pointer",
              fontFamily: "inherit",
              fontWeight: 600,
              transition: "all 0.15s",
            }}
          >
            {saveState === "saved"
              ? "Saved"
              : saveState === "saving"
              ? "Saving..."
              : saveState === "error"
              ? "Try again"
              : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
