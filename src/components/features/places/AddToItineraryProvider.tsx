"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { AddToItineraryModal } from "./AddToItineraryModal";
import type { AddToItineraryPlace } from "@/lib/add-to-itinerary";

interface AddToItineraryContextValue {
  open: (place: AddToItineraryPlace) => void;
}

export const AddToItineraryContext = createContext<AddToItineraryContextValue | null>(null);

export function useAddToItinerary(): AddToItineraryContextValue {
  const ctx = useContext(AddToItineraryContext);
  if (!ctx) throw new Error("useAddToItinerary must be used inside AddToItineraryProvider");
  return ctx;
}

interface AddToItineraryProviderProps {
  children: React.ReactNode;
}

export function AddToItineraryProvider({ children }: AddToItineraryProviderProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingPlace, setPendingPlace] = useState<AddToItineraryPlace | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const open = useCallback((place: AddToItineraryPlace) => {
    setPendingPlace(place);
    setModalOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setPendingPlace(null);
  }, []);

  const handleSuccess = useCallback((message: string) => {
    setSuccessToast(message);
    setTimeout(() => setSuccessToast(null), 3000);
  }, []);

  return (
    <AddToItineraryContext.Provider value={{ open }}>
      {children}
      <AddToItineraryModal
        open={modalOpen}
        place={pendingPlace}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
      {successToast && (
        <div
          style={{
            position: "fixed", bottom: 88, left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#1B3A5C", color: "#fff",
            padding: "10px 20px", borderRadius: 999,
            fontSize: 13, fontWeight: 600, zIndex: 1300,
            pointerEvents: "none", whiteSpace: "nowrap",
          }}
        >
          {successToast}
        </div>
      )}
    </AddToItineraryContext.Provider>
  );
}
