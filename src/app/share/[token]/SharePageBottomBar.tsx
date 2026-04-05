"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";

export function SharePageBottomBar({
  tripId,
  isOwner,
}: {
  tripId: string;
  isOwner: boolean;
}) {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);
  const [error, setError] = useState(false);

  // Redirect back to this share page after login/signup
  const redirectUrl = encodeURIComponent(pathname ?? "");

  async function handleAddToTrips() {
    setCloning(true);
    setError(false);
    try {
      const res = await fetch(`/api/trips/${tripId}/clone`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as { tripId: string };
      setCloned(true);
      setTimeout(() => {
        router.push(`/trips/${data.tripId}`);
      }, 800);
    } catch {
      setError(true);
      setCloning(false);
    }
  }

  // Not loaded yet — render nothing to avoid layout flash
  if (!isLoaded) return null;

  // Owner sees nothing — they already have this trip
  if (isOwner) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: "#fff",
        borderTop: "1px solid #F0F0F0",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
      }}
    >
      {isSignedIn ? (
        /* Logged-in non-owner: clone button */
        <>
          <button
            onClick={handleAddToTrips}
            disabled={cloning || cloned}
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "14px",
              borderRadius: "999px",
              backgroundColor: cloned ? "#6B8F71" : "#C4664A",
              color: "#fff",
              fontWeight: 700,
              fontSize: "15px",
              border: "none",
              cursor: cloning || cloned ? "not-allowed" : "pointer",
              opacity: cloning ? 0.8 : 1,
              transition: "background-color 0.2s",
            }}
          >
            {cloned ? "Added to your trips!" : cloning ? "Adding..." : "Add to my trips"}
          </button>
          {error ? (
            <p style={{ fontSize: "12px", color: "#C4664A" }}>Something went wrong. Please try again.</p>
          ) : (
            <p style={{ fontSize: "12px", color: "#AAAAAA" }}>Saves a copy to your Flokk account</p>
          )}
        </>
      ) : (
        /* Non-user: sign-up CTA with redirect back to this page */
        <>
          <p style={{ fontSize: "15px", fontWeight: 800, color: "#1a1a1a", textAlign: "center", marginBottom: "2px" }}>
            Plan your own family trip with Flokk — free to join
          </p>
          <p style={{ fontSize: "12px", color: "#717171", textAlign: "center" }}>
            Save places from anywhere. Build your itinerary. Travel smarter.
          </p>
          <a
            href={`/sign-up?redirect_url=${redirectUrl}`}
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "14px",
              borderRadius: "999px",
              backgroundColor: "#C4664A",
              color: "#fff",
              fontWeight: 700,
              fontSize: "15px",
              textAlign: "center",
              textDecoration: "none",
              display: "block",
            }}
          >
            Get started free
          </a>
          <p style={{ fontSize: "12px", color: "#AAAAAA" }}>
            Already have an account?{" "}
            <a
              href={`/sign-in?redirect_url=${redirectUrl}`}
              style={{ color: "#C4664A", textDecoration: "none", fontWeight: 600 }}
            >
              Sign in
            </a>
          </p>
        </>
      )}
    </div>
  );
}
