"use client";

import { useEffect, useState } from "react";
import { Mail, Link as LinkIcon, Bookmark, X } from "lucide-react";

const STORAGE_KEY = "flokk.welcomeBanner.dismissed.v1";

export function WelcomeBanner() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setDismissed(true);
    } catch { /* storage disabled, always show */ }
  }, []);

  function handleDismiss() {
    setDismissed(true);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
  }

  if (!mounted || dismissed) return null;

  return (
    <div style={{
      position: "relative",
      background: "#FFF8F3",
      border: "1px solid #E8D5C8",
      borderRadius: 12,
      padding: "20px 24px",
      marginBottom: 24,
    }}>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss welcome banner"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          padding: 4,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#999",
        }}
      >
        <X size={16} />
      </button>
      <h3 style={{
        margin: "0 0 4px 0",
        fontSize: 18,
        fontWeight: 700,
        color: "#1B3A5C",
      }}>
        Three ways to save to Flokk
      </h3>
      <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#666" }}>
        Flokk pulls your travel plans in from anywhere you already use.
      </p>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 12,
      }}>
        <div style={{
          padding: "14px 16px",
          background: "#fff",
          border: "1px solid #E8D5C8",
          borderRadius: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Mail size={16} style={{ color: "#C4664A" }} />
            <strong style={{ fontSize: 14, color: "#1B3A5C" }}>Forward an email</strong>
          </div>
          <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>
            Send booking confirmations or tour quotes to{" "}
            <code style={{
              background: "#F5EDE5",
              padding: "1px 4px",
              borderRadius: 3,
              fontSize: 11,
            }}>trips@flokktravel.com</code>
            . Flokk extracts the details and organizes them automatically.
          </div>
        </div>
        <div style={{
          padding: "14px 16px",
          background: "#fff",
          border: "1px solid #E8D5C8",
          borderRadius: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <LinkIcon size={16} style={{ color: "#C4664A" }} />
            <strong style={{ fontSize: 14, color: "#1B3A5C" }}>Paste a link</strong>
          </div>
          <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>
            Saw something on Instagram, TikTok, or a blog? Drop the link in your Saves
            and Flokk captures the photo, title, and location.
          </div>
        </div>
        <div style={{
          padding: "14px 16px",
          background: "#fff",
          border: "1px solid #E8D5C8",
          borderRadius: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Bookmark size={16} style={{ color: "#C4664A" }} />
            <strong style={{ fontSize: 14, color: "#1B3A5C" }}>Save in-app</strong>
          </div>
          <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>
            Tap any spot in Discover or a recommendation on your trip page to save it for later.
          </div>
        </div>
      </div>
    </div>
  );
}
