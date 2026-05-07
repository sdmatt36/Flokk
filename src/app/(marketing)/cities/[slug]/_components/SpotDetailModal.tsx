"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";
import { Playfair_Display } from "next/font/google";
import { SpotImage } from "@/components/shared/SpotImage";
import type { CompactSpotCardProps } from "./cards";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"] });

interface SpotDetailModalProps {
  spot: CompactSpotCardProps;
  cityName: string;
  onClose: () => void;
}

export function SpotDetailModal({ spot, cityName, onClose }: SpotDetailModalProps) {
  const { isSignedIn } = useUser();
  const [mounted, setMounted] = useState(false);
  const [flokked, setFlokked] = useState(false);
  const [flokking, setFlokking] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleFlokkIt() {
    if (flokked || flokking) return;
    setFlokking(true);
    try {
      await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceMethod: "URL_PASTE",
          title: spot.name,
          city: cityName,
          category: spot.category ?? null,
        }),
      });
      setFlokked(true);
    } catch {
      // silent
    } finally {
      setFlokking(false);
    }
  }

  const subtitle = spot.cuisine ?? spot.lodgingType ?? spot.category;

  if (!mounted) return null;

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
      onClick={onClose}
    >
      <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.55)" }} />
      <div
        style={{
          position: "relative", backgroundColor: "#fff", borderRadius: "20px",
          width: "100%", maxWidth: "480px", overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: "12px", right: "12px", zIndex: 2,
            width: "30px", height: "30px", borderRadius: "50%",
            backgroundColor: "rgba(0,0,0,0.45)", border: "none",
            cursor: "pointer", color: "#fff", fontSize: "18px",
            display: "flex", alignItems: "center", justifyContent: "center",
            lineHeight: 1,
          }}
          aria-label="Close"
        >
          ×
        </button>

        {/* Photo */}
        <div style={{ height: "200px", backgroundColor: "#f3f4f6", overflow: "hidden" }}>
          <SpotImage
            spotId={spot.id}
            src={spot.photoUrl}
            category={spot.category}
            alt={spot.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            allowResolve={false}
          />
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px 24px" }}>
          <h2
            className={playfair.className}
            style={{ fontSize: "22px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 8px", lineHeight: 1.25 }}
          >
            {spot.name}
          </h2>

          {subtitle && (
            <span style={{
              fontSize: "12px", color: "#C4664A", backgroundColor: "#FFF3EE",
              borderRadius: "20px", padding: "3px 10px", textTransform: "capitalize",
              display: "inline-block", marginBottom: "12px",
            }}>
              {subtitle.replace(/_/g, " ")}
            </span>
          )}

          {spot.ratingCount > 0 && (
            <p style={{ fontSize: "13px", color: "#C4664A", margin: "0 0 10px" }}>
              {"★".repeat(Math.round(spot.averageRating ?? 0))}
              <span style={{ color: "#888", marginLeft: "6px" }}>
                {spot.averageRating?.toFixed(1)} · {spot.ratingCount}{" "}
                {spot.ratingCount === 1 ? "family" : "families"}
              </span>
            </p>
          )}

          {spot.description && (
            <p style={{ fontSize: "13px", color: "#444", lineHeight: 1.6, margin: "0 0 20px" }}>
              {spot.description}
            </p>
          )}

          {isSignedIn ? (
            <button
              onClick={handleFlokkIt}
              disabled={flokked || flokking}
              style={{
                width: "100%", padding: "12px", borderRadius: "12px",
                backgroundColor: flokked ? "#F0FAF0" : "#C4664A",
                color: flokked ? "#2E7D32" : "#fff",
                border: "none", fontSize: "14px", fontWeight: 600,
                cursor: flokked || flokking ? "default" : "pointer",
                transition: "background-color 0.2s",
              }}
            >
              {flokked ? "Flokked" : flokking ? "Saving..." : "Flokk it"}
            </button>
          ) : (
            <a
              href="/sign-up"
              style={{
                display: "block", textAlign: "center", padding: "12px",
                borderRadius: "12px", backgroundColor: "#C4664A", color: "#fff",
                textDecoration: "none", fontSize: "14px", fontWeight: 600,
              }}
            >
              Sign up to save spots
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
