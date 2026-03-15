"use client";

import { CreditCard } from "lucide-react";

export function PaymentSection() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{
        backgroundColor: "#fff", borderRadius: "12px",
        border: "1px dashed #E8E8E8", padding: "48px 24px",
        display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
      }}>
        <CreditCard size={32} style={{ color: "#C4664A" }} />
        <p style={{ color: "#1B3A5C", fontWeight: 500, fontSize: "15px", marginTop: "12px", marginBottom: 0 }}>
          No payment methods yet
        </p>
        <p style={{ color: "#717171", fontSize: "14px", maxWidth: "360px", marginTop: "8px", lineHeight: 1.5 }}>
          Add the cards you use for travel — we&apos;ll surface relevant perks and rewards during trip planning.
        </p>
        <button style={{
          backgroundColor: "#1B3A5C", color: "#fff", border: "none",
          borderRadius: "8px", padding: "9px 20px", fontSize: "14px",
          fontWeight: 500, cursor: "pointer", marginTop: "16px",
        }}>
          + Add card
        </button>
      </div>
      <p style={{ color: "#717171", fontSize: "12px", textAlign: "center" }}>
        Full card integration and travel benefit tracking coming in a future update.
      </p>
    </div>
  );
}
