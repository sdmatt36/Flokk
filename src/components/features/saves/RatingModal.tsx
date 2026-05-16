"use client";

import { useState } from "react";

type Props = {
  itemId: string;
  title: string;
  onClose: () => void;
  onRated: (id: string, value: number) => void;
};

export function RatingModal({ itemId, title, onClose, onRated }: Props) {
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingNotes, setRatingNotes] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "360px", display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: 18, fontWeight: 700, color: "#1B3A5C", margin: 0, lineHeight: 1.3 }}>
          {title.length > 40 ? title.slice(0, 40) + "…" : title}
        </h2>

        {/* Star selector */}
        <div style={{ display: "flex", gap: "8px" }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRatingValue(star)}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "28px", color: star <= ratingValue ? "#f59e0b" : "#d1d5db", lineHeight: 1 }}
            >
              ★
            </button>
          ))}
        </div>

        {/* Notes */}
        <textarea
          placeholder="What did you think?"
          value={ratingNotes}
          onChange={(e) => setRatingNotes(e.target.value)}
          rows={3}
          style={{ border: "1px solid #E8E8E8", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#0A1628", outline: "none", fontFamily: "Inter, sans-serif", resize: "vertical" }}
        />

        {/* Save button */}
        <button
          disabled={ratingValue === 0 || ratingSubmitting}
          onClick={async () => {
            if (ratingValue === 0) return;
            setRatingSubmitting(true);
            try {
              const res = await fetch(`/api/saves/${itemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userRating: ratingValue, notes: ratingNotes.trim() || undefined }),
              });
              if (res.ok) {
                onRated(itemId, ratingValue);
                onClose();
              }
            } finally {
              setRatingSubmitting(false);
            }
          }}
          style={{ padding: "12px 0", borderRadius: 8, border: "none", backgroundColor: ratingValue > 0 ? "#C4664A" : "#E8E8E8", color: ratingValue > 0 ? "#fff" : "#aaa", fontSize: 14, fontWeight: 600, cursor: ratingValue > 0 ? "pointer" : "default", fontFamily: "Inter, sans-serif" }}
        >
          {ratingSubmitting ? "Saving…" : "Save rating"}
        </button>

        {/* Cancel */}
        <button
          type="button"
          onClick={onClose}
          style={{ background: "none", border: "none", padding: 0, fontSize: "13px", color: "#717171", cursor: "pointer", fontFamily: "Inter, sans-serif", textAlign: "center" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
