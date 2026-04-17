"use client";

import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropLinkModal } from "./DropLinkModal";

type Trip = { id: string; title: string; startDate: string | null; endDate: string | null; status?: string };

const CARD_GRADIENT =
  "linear-gradient(to bottom, transparent 0%, transparent 30%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.85) 100%)";

export function DropLinkTile({ trips }: { trips: Trip[] }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  // Listen for the deferred refresh event dispatched by the modal after close
  useEffect(() => {
    function onRefresh() { router.refresh(); }
    window.addEventListener("flokk:refresh", onRefresh);
    return () => window.removeEventListener("flokk:refresh", onRefresh);
  }, [router]);

  function handleSaved(tripTitle: string | null) {
    const msg = tripTitle ? `Saved to ${tripTitle}` : "Saved for later";
    setToast(msg);
    setToastVisible(true);
    // Fade out after 2.2s, remove DOM after 2.7s
    setTimeout(() => setToastVisible(false), 2200);
    setTimeout(() => setToast(null), 2700);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        style={{
          position: "relative",
          borderRadius: "16px",
          overflow: "hidden",
          display: "block",
          height: "160px",
          backgroundImage:
            "url('https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=400&q=80')",
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
          <Bookmark size={20} style={{ color: "#fff", marginBottom: "8px" }} />
          <p style={{ fontWeight: 700, color: "#fff", fontSize: "17px" }}>Drop a link</p>
          <p style={{ color: "#fff", fontSize: "12px", opacity: 0.85, marginTop: "2px" }}>
            Instagram, TikTok, anywhere
          </p>
        </div>
      </button>

      {modalOpen && (
        <DropLinkModal
          trips={trips}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Toast — rendered outside modal so it survives modal close */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "90px",
            left: "50%",
            transform: `translateX(-50%) translateY(${toastVisible ? "0" : "10px"})`,
            opacity: toastVisible ? 1 : 0,
            transition: "opacity 0.25s ease, transform 0.25s ease",
            backgroundColor: "#C4664A",
            color: "#fff",
            fontWeight: 600,
            fontSize: "14px",
            padding: "12px 24px",
            borderRadius: "12px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            whiteSpace: "nowrap",
            zIndex: 300,
            pointerEvents: "none",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
