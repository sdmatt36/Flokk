"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

export function SharePageBottomBar({
  tripId,
  isOwner,
  shareToken,
  tripDestination,
  totalActivityCount,
}: {
  tripId: string;
  isOwner: boolean;
  shareToken?: string;
  tripDestination: string;
  totalActivityCount: number;
}) {
  const { isSignedIn, isLoaded } = useAuth();
  const pathname = usePathname();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [stealing, setStealing] = useState(false);
  const [stolen, setStolen] = useState<{ tripId: string; tripTitle: string; copied: number } | null>(null);

  const redirectUrl = encodeURIComponent(pathname ?? "");

  async function handleStealConfirm() {
    if (!shareToken) return;
    setStealing(true);
    try {
      const res = await fetch("/api/trips/steal-to-new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareToken }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as { tripId: string; tripTitle: string; copied: number };
      setStolen(data);
      setConfirmOpen(false);
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setStealing(false);
    }
  }

  if (!isLoaded) return null;

  if (isOwner) {
    return (
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, backgroundColor: "#fff", borderTop: "1px solid #F0F0F0", padding: "14px 20px", textAlign: "center", boxShadow: "0 -4px 24px rgba(0,0,0,0.06)" }}>
        <p style={{ fontSize: "13px", color: "#888", margin: "0 0 4px" }}>This is your trip</p>
        <a href={`/trips/${tripId}`} style={{ fontSize: "14px", fontWeight: 700, color: "#C4664A", textDecoration: "none" }}>
          View &amp; edit →
        </a>
        {shareToken && (
          <p style={{ fontSize: "12px", color: "#AAAAAA", margin: "6px 0 0" }}>
            <a href={`/share/${shareToken}?preview=true`} style={{ color: "#AAAAAA", textDecoration: "underline" }}>
              Preview as visitor
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Success toast */}
      {stolen && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1B3A5C] text-white text-sm px-4 py-3 rounded-xl shadow-lg flex flex-col items-center gap-2 z-50 w-72 text-center">
          <span className="font-semibold">{stolen.tripTitle} created</span>
          <span className="text-xs" style={{ color: "#D1D5DB" }}>
            {stolen.copied} places saved. Add dates to start planning.
          </span>
          <a
            href={`/trips/${stolen.tripId}`}
            className="text-[#C4664A] font-semibold text-sm"
          >
            View trip →
          </a>
        </div>
      )}

      {/* Bottom bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, backgroundColor: "#fff", borderTop: "1px solid #F0F0F0", padding: "16px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}>
        {isSignedIn ? (
          <>
            <button
              onClick={() => setConfirmOpen(true)}
              style={{ width: "100%", maxWidth: "400px", padding: "14px", borderRadius: "999px", backgroundColor: "#C4664A", color: "#fff", fontWeight: 700, fontSize: "15px", border: "none", cursor: "pointer" }}
            >
              Steal This Itinerary
            </button>
            <p style={{ fontSize: "12px", color: "#888", margin: 0, textAlign: "center" }}>
              or save individual places above
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: "15px", fontWeight: 800, color: "#1a1a1a", textAlign: "center", marginBottom: "2px" }}>
              Plan your own family trip with Flokk — free to join
            </p>
            <p style={{ fontSize: "12px", color: "#717171", textAlign: "center" }}>
              Save places from anywhere. Build your itinerary. Travel smarter.
            </p>
            <a
              href={`/sign-up?redirect_url=${redirectUrl}`}
              style={{ width: "100%", maxWidth: "400px", padding: "14px", borderRadius: "999px", backgroundColor: "#C4664A", color: "#fff", fontWeight: 700, fontSize: "15px", textAlign: "center", textDecoration: "none", display: "block" }}
            >
              Get started free
            </a>
            <p style={{ fontSize: "12px", color: "#AAAAAA" }}>
              Already have an account?{" "}
              <a href={`/sign-in?redirect_url=${redirectUrl}`} style={{ color: "#C4664A", textDecoration: "none", fontWeight: 600 }}>
                Sign in
              </a>
            </p>
          </>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 pb-32"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#1B3A5C", marginBottom: "8px" }}>
              Start planning {tripDestination}?
            </h2>
            <p style={{ fontSize: "14px", color: "#717171", marginBottom: "24px", lineHeight: 1.5 }}>
              We&apos;ll create a new {tripDestination} trip and copy all{" "}
              {totalActivityCount} activities into it as saved places. You can
              organise them into days from there.
            </p>
            <button
              onClick={handleStealConfirm}
              disabled={stealing}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "999px",
                backgroundColor: stealing ? "#E5E5E5" : "#C4664A",
                color: stealing ? "#AAAAAA" : "#fff",
                fontWeight: 700,
                fontSize: "15px",
                border: "none",
                cursor: stealing ? "not-allowed" : "pointer",
                marginBottom: "12px",
              }}
            >
              {stealing ? "Creating your trip..." : `Create my ${tripDestination} trip`}
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              style={{ width: "100%", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#AAAAAA", padding: "4px 0", fontFamily: "inherit" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
