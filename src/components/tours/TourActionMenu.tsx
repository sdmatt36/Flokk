"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, ArrowRight, Trash2 } from "lucide-react";

interface TourActionMenuProps {
  tourId: string;
  onDelete: (tourId: string) => void;
  anchorPosition?: "card" | "pill";
}

export function TourActionMenu({ tourId, onDelete, anchorPosition = "card" }: TourActionMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tours/${tourId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDeleting(false);
      setOpen(false);
      onDelete(tourId);
    } catch {
      setDeleting(false);
      setOpen(false);
      alert("Could not delete tour. Please try again.");
    }
  }

  const isCard = anchorPosition === "card";

  const triggerStyle: React.CSSProperties = isCard
    ? {
        width: 28,
        height: 28,
        borderRadius: "50%",
        backgroundColor: "rgba(0,0,0,0.4)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        cursor: "pointer",
      }
    : {
        width: 24,
        height: 24,
        borderRadius: 4,
        backgroundColor: "transparent",
        color: "#1B3A5C",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        cursor: "pointer",
      };

  const triggerHoverStyle: React.CSSProperties = isCard
    ? { backgroundColor: "rgba(0,0,0,0.6)" }
    : { backgroundColor: "rgba(0,0,0,0.05)" };

  const [hoveringTrigger, setHoveringTrigger] = useState(false);

  const popoverStyle: React.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 6px)",
    ...(isCard ? { right: 0 } : { left: 0 }),
    width: 180,
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    borderRadius: 8,
    padding: 4,
    zIndex: 50,
  };

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        onMouseEnter={() => setHoveringTrigger(true)}
        onMouseLeave={() => setHoveringTrigger(false)}
        style={{ ...triggerStyle, ...(hoveringTrigger ? triggerHoverStyle : {}) }}
        aria-label="Tour actions"
      >
        <MoreVertical size={14} />
      </button>

      {open && (
        <div style={popoverStyle}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); router.push(`/tour?id=${tourId}`); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 10px",
              background: "none",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              color: "#1B3A5C",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <ArrowRight size={14} />
            Go to tour
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 10px",
              background: "none",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              color: "#C4664A",
              cursor: deleting ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              textAlign: "left",
              opacity: deleting ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!deleting) e.currentTarget.style.backgroundColor = "#f8fafc"; }}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Trash2 size={14} />
            {deleting ? "Deleting…" : "Delete tour"}
          </button>
        </div>
      )}
    </div>
  );
}
