"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { createPortal } from "react-dom";

export function ShareTripButton({ shareToken }: { shareToken: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `https://www.flokktravel.com/share/${shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        onClick={handleShare}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          backgroundColor: "rgba(255,255,255,0.2)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.3)",
          borderRadius: "20px",
          padding: "6px 14px",
          color: "#fff",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <Share2 size={14} />
        Share
      </button>

      {copied &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              bottom: "32px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 9999,
              backgroundColor: "#1a1a1a",
              color: "#fff",
              borderRadius: "999px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              pointerEvents: "none",
              boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
              whiteSpace: "nowrap",
            }}
          >
            Link copied
          </div>,
          document.body
        )}
    </>
  );
}
