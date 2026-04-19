"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteTripButtonProps {
  tripId: string;
  tripTitle?: string | null;
}

export function DeleteTripButton({ tripId, tripTitle }: DeleteTripButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.push("/trips");
    } catch (err) {
      console.error(err);
      setDeleting(false);
      setShowConfirm(false);
      alert("Couldn't delete trip. Please try again.");
    }
  };

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

      {showConfirm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !deleting && setShowConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-[Playfair_Display] font-bold text-[#1B3A5C] mb-3">
              Are you Flokkin sure?
            </h3>
            <p className="text-sm text-gray-600 font-[DM_Sans] mb-2 leading-relaxed">
              Deleting <span className="font-semibold text-[#1B3A5C]">{tripTitle ?? "this trip"}</span> removes the itinerary, vault documents, and manual activities.
            </p>
            <p className="text-sm text-gray-600 font-[DM_Sans] mb-6 leading-relaxed">
              Your saved places stay in your library. Your ratings stay visible to the community. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-[DM_Sans] text-gray-600 hover:text-[#1B3A5C] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-[DM_Sans] text-[#C4664A] border border-[#C4664A] rounded-full hover:bg-[#C4664A] hover:text-white disabled:opacity-50 transition"
              >
                {deleting ? "Deleting..." : "Delete trip"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
