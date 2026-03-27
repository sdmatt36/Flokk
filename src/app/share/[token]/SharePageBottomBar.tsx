"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export function SharePageBottomBar({
  tripId,
  tripTitle,
}: {
  tripId: string;
  tripTitle: string;
}) {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);

  async function handleAddToTrips() {
    setCloning(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/clone`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as { tripId: string };
      setCloned(true);
      setTimeout(() => {
        router.push(`/trips/${data.tripId}`);
      }, 800);
    } catch {
      setCloning(false);
    }
  }

  if (!isLoaded) return null;

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
          <p style={{ fontSize: "12px", color: "#AAAAAA" }}>
            Saves a copy to your Flokk account
          </p>
        </>
      ) : (
        <>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", textAlign: "center" }}>
            Plan your own trip like this one
          </p>
          <a
            href="/sign-up"
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "14px",
              borderRadius: "999px",
              backgroundColor: "#C4664A",
              color: "#fff",
              fontWeight: 700,
              fontSize: "15px",
              border: "none",
              textAlign: "center",
              textDecoration: "none",
              display: "block",
            }}
          >
            Get started free
          </a>
          <p style={{ fontSize: "12px", color: "#AAAAAA" }}>
            Already have an account?{" "}
            <a href="/sign-in" style={{ color: "#C4664A", textDecoration: "none", fontWeight: 600 }}>
              Sign in
            </a>
          </p>
        </>
      )}
    </div>
  );
}
