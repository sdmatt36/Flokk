"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

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

  const steps = [
    {
      num: "01",
      title: "Forward an email",
      body: (
        <>
          Send any booking or tour quote to{" "}
          <code style={{
            background: "#F5EDE5",
            padding: "1px 6px",
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, monospace)",
            color: "#1B3A5C",
          }}>trips@flokktravel.com</code>. We extract the details.
        </>
      ),
    },
    {
      num: "02",
      title: "Paste a link",
      body: <>Spotted something on Instagram, TikTok, or a blog? Drop the link in Saves.</>,
    },
    {
      num: "03",
      title: "Save in-app",
      body: <>Tap any spot or recommendation inside Flokk to bookmark it for later.</>,
    },
  ];

  return (
    <div style={{
      position: "relative",
      background: "#fff",
      border: "1px solid #F0E4D8",
      borderRadius: 16,
      padding: "28px 32px 20px 32px",
      marginBottom: 28,
      boxShadow: "0 6px 24px rgba(27, 58, 92, 0.06)",
    }}>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          padding: 4,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#AAA",
          lineHeight: 0,
        }}
      >
        <X size={16} />
      </button>

      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "#C4664A",
        marginBottom: 6,
      }}>
        Welcome to Flokk
      </div>
      <h3 style={{
        margin: "0 0 20px 0",
        fontSize: 22,
        fontWeight: 700,
        color: "#1B3A5C",
        fontFamily: "var(--font-playfair), Georgia, serif",
        lineHeight: 1.2,
      }}>
        Three ways to send your travel life into Flokk
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {steps.map((s, i) => (
          <div
            key={s.num}
            style={{
              display: "grid",
              gridTemplateColumns: "64px 1fr",
              alignItems: "baseline",
              gap: 16,
              paddingTop: i === 0 ? 0 : 14,
              paddingBottom: i === steps.length - 1 ? 0 : 14,
              borderTop: i === 0 ? "none" : "1px solid #F5EDE5",
            }}
          >
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#C4664A",
              fontFamily: "var(--font-playfair), Georgia, serif",
              letterSpacing: "-0.01em",
              lineHeight: 1,
            }}>
              {s.num}
            </div>
            <div>
              <div style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#1B3A5C",
                marginBottom: 2,
                lineHeight: 1.3,
              }}>
                {s.title}
              </div>
              <div style={{
                fontSize: 13,
                color: "#666",
                lineHeight: 1.5,
              }}>
                {s.body}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
