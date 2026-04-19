"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteTripConfirmModal } from "./DeleteTripConfirmModal";

interface DeleteTripButtonProps {
  tripId: string;
  tripTitle?: string | null;
}

export function DeleteTripButton({ tripId, tripTitle }: DeleteTripButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <div className="mt-16 mb-8 flex justify-center">
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="text-sm text-[#C4664A] hover:text-[#1B3A5C] underline font-[DM_Sans] opacity-70 hover:opacity-100 transition"
        >
          Delete trip
        </button>
      </div>

      <DeleteTripConfirmModal
        tripId={tripId}
        tripTitle={tripTitle}
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onDeleted={() => router.push("/trips")}
      />
    </>
  );
}
