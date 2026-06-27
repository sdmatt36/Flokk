"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Plus } from "lucide-react";
import { QuickAddModal } from "@/components/shared/QuickAddModal";

// Shared empty-state for every Discover surface (city / country / discover sections).
// Replaces the old passive "no X yet" dead copy with an actionable CTA that feeds the
// content flywheel: signed-in users open the real add flow (QuickAddModal); signed-out
// users are routed to sign-up. Keeps the same dashed-box container so layout is unchanged.
//
// Modal ownership: when a host section already mounts its own QuickAddModal, pass `onAdd`
// (the section's open handler) so we reuse it and never double-mount. Only when no `onAdd`
// is given does this component own its own QuickAddModal.

const NAVY = "#1B3A5C";
const TERRA = "#C4664A";

type EmptyStateCTAProps = {
  message: string;
  ctaLabel?: string;
  prefillCity?: string;
  defaultTab?: "pick" | "itinerary" | "tour";
  /** When set, the signed-in CTA calls this instead of owning a modal (reuse host section's). */
  onAdd?: () => void;
};

const BOX: React.CSSProperties = {
  padding: "32px 24px",
  backgroundColor: "#FAFAFA",
  borderRadius: "12px",
  border: "1px dashed #E5E7EB",
  textAlign: "center",
};

const CTA: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  marginTop: 12,
  padding: "8px 16px",
  borderRadius: 999,
  backgroundColor: NAVY,
  color: "#fff",
  border: "none",
  cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

export function EmptyStateCTA({
  message,
  ctaLabel = "Add the first pick",
  prefillCity = "",
  defaultTab = "pick",
  onAdd,
}: EmptyStateCTAProps) {
  const { isSignedIn } = useUser();
  const [modalOpen, setModalOpen] = useState(false);
  const ownsModal = !onAdd;

  return (
    <div style={BOX}>
      <p style={{ fontSize: 14, color: "#9CA3AF", margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
        {message}
      </p>

      {isSignedIn ? (
        <button
          type="button"
          onClick={() => (onAdd ? onAdd() : setModalOpen(true))}
          style={CTA}
        >
          <Plus size={15} color={TERRA} strokeWidth={2.4} />
          {ctaLabel}
        </button>
      ) : (
        <Link href="/sign-up" style={CTA}>
          <Plus size={15} color={TERRA} strokeWidth={2.4} />
          Sign up to add the first pick
        </Link>
      )}

      {ownsModal && (
        <QuickAddModal
          isOpen={modalOpen}
          defaultTab={defaultTab}
          prefillCity={prefillCity}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
