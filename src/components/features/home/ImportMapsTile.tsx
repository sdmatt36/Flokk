"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { ImportMapsModal } from "@/components/features/saves/ImportMapsModal";

const CARD_GRADIENT =
  "linear-gradient(to bottom, transparent 0%, transparent 30%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.85) 100%)";

export function ImportMapsTile() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        style={{
          position: "relative",
          borderRadius: "16px",
          overflow: "hidden",
          display: "block",
          height: "160px",
          backgroundImage:
            "url('https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          border: "none",
          cursor: "pointer",
          width: "100%",
          padding: 0,
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
        <div style={{ position: "absolute", inset: 0, background: CARD_GRADIENT }} />
        <div
          style={{
            position: "relative",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            height: "100%",
            boxSizing: "border-box",
          }}
        >
          <MapPin size={20} style={{ color: "#fff", marginBottom: "8px" }} />
          <p style={{ fontWeight: 700, color: "#fff", fontSize: "17px" }}>Bring Your Saves</p>
          <p style={{ color: "#fff", fontSize: "12px", opacity: 0.85, marginTop: "2px" }}>
            Straight from Google Maps
          </p>
        </div>
      </button>

      {showModal && (
        <ImportMapsModal onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
