"use client";

import { useRouter } from "next/navigation";
import { setShareReturn } from "@/lib/share-return";

// "Add all to my Flokk" for a shared city. The import funnel (/saves/from-share) sends a
// logged-out viewer through sign-in -> sign-up -> onboarding; stash the funnel path in the share
// return cookie first so a NEW user lands back on the import after onboarding instead of /home.
export function CityImportCTA({ token }: { token: string }) {
  const router = useRouter();
  const target = `/saves/from-share?cityToken=${token}`;
  return (
    <button
      onClick={() => {
        setShareReturn(target);
        router.push(target);
      }}
      style={{
        display: "inline-block",
        padding: "12px 28px",
        borderRadius: 24,
        background: "#C4664A",
        color: "#fff",
        fontWeight: 700,
        fontSize: 14,
        border: "none",
        cursor: "pointer",
      }}
    >
      Add all to my Flokk
    </button>
  );
}
