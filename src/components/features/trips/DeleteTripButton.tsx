"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteTripButton({ tripId, tripTitle }: { tripId: string; tripTitle: string }) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteTrip = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.push("/trips");
    } catch (err) {
      console.error(err);
      setDeleting(false);
      setShowDeleteConfirm(false);
      alert("Couldn't delete trip. Please try again.");
    }
  };

  return (
    <>
      <div className="mt-16 mb-8 flex justify-center">
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="text-sm text-[#C4664A] hover:text-[#1B3A5C] underline font-[DM_Sans] opacity-70 hover:opacity-100 transition"
        >
          Delete trip
        </button>
      </div>

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-[Playfair_Display] font-bold text-[#1B3A5C] mb-3">
              Delete {tripTitle}?
            </h3>
            <p className="text-sm text-gray-600 font-[DM_Sans] mb-6">
              This removes the itinerary, vault documents, and manual activities. Your saved places
              stay in your library. Your ratings stay visible to the community. This cannot be
              undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-[DM_Sans] text-gray-600 hover:text-[#1B3A5C] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTrip}
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
