"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

interface Props {
  spotId: string;
  spotName: string;
  spotCity: string | null;
  spotPhotoUrl: string | null;
  spotCategory: string | null;
  spotWebsiteUrl: string | null;
  shareToken: string;
  isSignedIn: boolean;
}

export function SpotDetailActions({ spotId, spotName, spotCity, spotPhotoUrl, spotCategory, spotWebsiteUrl, shareToken, isSignedIn }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Share");

  const handleFlokk = useCallback(async () => {
    if (!isSignedIn) return;
    setSaving(true);
    try {
      await fetch("/api/saves/from-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: spotName,
          city: spotCity,
          placePhotoUrl: spotPhotoUrl ?? undefined,
          websiteUrl: spotWebsiteUrl ?? undefined,
          category: spotCategory ?? undefined,
        }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }, [isSignedIn, spotName, spotCity, spotPhotoUrl, spotWebsiteUrl, spotCategory]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Share"), 2000);
    } catch {
      // fallback: do nothing
    }
  }, []);

  if (!isSignedIn) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <p style={{ fontSize: "14px", color: "#717171", marginBottom: "16px" }}>
          Create a free Flokk account to save this spot, add it to a trip, and discover more like it.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href={`/sign-up?redirect_url=/spots/${shareToken}`}
            style={{ backgroundColor: "#C4664A", color: "#fff", borderRadius: "12px", padding: "12px 24px", fontSize: "14px", fontWeight: 600, textDecoration: "none", display: "inline-block" }}
          >
            Sign up free
          </Link>
          <Link
            href={`/sign-in?redirect_url=/spots/${shareToken}`}
            style={{ backgroundColor: "#fff", color: "#1B3A5C", borderRadius: "12px", padding: "12px 24px", fontSize: "14px", fontWeight: 600, textDecoration: "none", display: "inline-block", border: "1px solid #E8DDC8" }}
          >
            Log in
          </Link>
          <button
            onClick={handleShare}
            style={{ backgroundColor: "#fff", color: "#1B3A5C", borderRadius: "12px", padding: "12px 24px", fontSize: "14px", fontWeight: 600, border: "1px solid #E8DDC8", cursor: "pointer" }}
          >
            {copyLabel}
          </button>
        </div>
        <p style={{ fontSize: "12px", color: "#AAAAAA", marginTop: "16px" }}>
          Flokk is free family travel planning — save spots, build itineraries, discover where other families go.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
      <button
        onClick={handleFlokk}
        disabled={saving || saved}
        style={{
          backgroundColor: saved ? "#10b981" : "#C4664A",
          color: "#fff",
          borderRadius: "12px",
          padding: "12px 24px",
          fontSize: "14px",
          fontWeight: 600,
          border: "none",
          cursor: saved || saving ? "default" : "pointer",
          opacity: saving ? 0.7 : 1,
          transition: "background-color 0.2s",
        }}
      >
        {saved ? "Saved to Flokk" : saving ? "Saving…" : "Flokk it"}
      </button>
      <button
        onClick={handleShare}
        style={{ backgroundColor: "#fff", color: "#1B3A5C", borderRadius: "12px", padding: "12px 24px", fontSize: "14px", fontWeight: 600, border: "1px solid #E8DDC8", cursor: "pointer" }}
      >
        {copyLabel}
      </button>
    </div>
  );
}
