"use client";

import { useState } from "react";
import Link from "next/link";
import { Construction, Plus } from "lucide-react";
import { Playfair_Display } from "next/font/google";
import { useUser } from "@clerk/nextjs";
import { QuickAddModal } from "@/components/shared/QuickAddModal";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

// Banner kept as a banner, but the passive "coming soon" dead copy is replaced with an
// actionable CTA: signed-in users open the add flow (QuickAddModal); signed-out users are
// routed to sign-up. Navy button on the terracotta banner.
const CTA: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 14px",
  borderRadius: 999,
  backgroundColor: "#1B3A5C",
  color: "#FBF6EC",
  border: "none",
  cursor: "pointer",
  textDecoration: "none",
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  whiteSpace: "nowrap",
};

export function UnderConstructionBanner() {
  const { isSignedIn } = useUser();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div
      className="w-full h-12 md:h-14 flex items-center justify-center px-4"
      style={{ backgroundColor: "#C4664A" }}
    >
      <div className="flex items-center gap-3 max-w-7xl mx-auto">
        <Construction className="size-5 shrink-0" style={{ color: "#FBF6EC" }} />
        <span className={`${playfair.className} text-base md:text-lg font-normal`} style={{ color: "#FBF6EC" }}>
          Excuse our Flokkin Mess.
        </span>
        {isSignedIn ? (
          <button type="button" onClick={() => setModalOpen(true)} style={CTA}>
            <Plus size={14} color="#FBF6EC" strokeWidth={2.4} />
            Add a pick
          </button>
        ) : (
          <Link href="/sign-up" style={CTA}>
            <Plus size={14} color="#FBF6EC" strokeWidth={2.4} />
            Sign up to add a pick
          </Link>
        )}
      </div>
      <QuickAddModal isOpen={modalOpen} defaultTab="pick" onClose={() => setModalOpen(false)} />
    </div>
  );
}
