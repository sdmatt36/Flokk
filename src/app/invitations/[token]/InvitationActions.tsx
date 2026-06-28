"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

const NAVY = "#1B3A5C";
const TERRACOTTA = "#C4664A";

// Logged-in Accept / Decline. Accept POSTs (which also resolves the already-a-collaborator case
// and returns the tripId); Decline DELETEs the pending invite, then returns home.
export function InvitationActions({ token, tripId }: { token: string; tripId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "accept" | "decline">(null);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy("accept");
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${token}`, { method: "POST" });
      if (!res.ok) {
        if (res.status === 410) {
          setError("This invitation is no longer valid.");
          setBusy(null);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { tripId?: string };
      router.push(`/trips/${data.tripId ?? tripId}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(null);
    }
  }

  async function decline() {
    setBusy("decline");
    setError(null);
    try {
      await fetch(`/api/invitations/${token}`, { method: "DELETE" });
      router.push("/home");
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={accept}
          disabled={busy !== null}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "7px",
            padding: "13px",
            borderRadius: "999px",
            backgroundColor: TERRACOTTA,
            color: "#fff",
            fontSize: "15px",
            fontWeight: 700,
            border: "none",
            cursor: busy ? "default" : "pointer",
            opacity: busy === "decline" ? 0.5 : 1,
          }}
        >
          <Check size={16} strokeWidth={2.5} />
          {busy === "accept" ? "Accepting..." : "Accept"}
        </button>
        <button
          onClick={decline}
          disabled={busy !== null}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "7px",
            padding: "13px 20px",
            borderRadius: "999px",
            backgroundColor: "#fff",
            color: NAVY,
            fontSize: "15px",
            fontWeight: 700,
            border: "1px solid #E5E7EB",
            cursor: busy ? "default" : "pointer",
            opacity: busy === "accept" ? 0.5 : 1,
          }}
        >
          <X size={16} strokeWidth={2.5} />
          {busy === "decline" ? "Declining..." : "Decline"}
        </button>
      </div>
      {error && (
        <p style={{ fontSize: "13px", color: TERRACOTTA, margin: "12px 0 0", textAlign: "center" }}>{error}</p>
      )}
    </div>
  );
}
