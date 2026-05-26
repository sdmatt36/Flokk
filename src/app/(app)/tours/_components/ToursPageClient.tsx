"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import YourToursSection from "@/components/features/build-a-tour/YourToursSection";

type SavedTourEntry = {
  id: string;
  title: string;
  createdAt: string;
  stopCount: number;
  transport: string;
  destinationCountry: string | null;
  destinationDisplayName: string;
  coverImage: string | null;
};

export function ToursPageClient() {
  const router = useRouter();
  const [savedTours, setSavedTours] = useState<Record<string, SavedTourEntry[]>>({});
  const [loadingTours, setLoadingTours] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tours/my-tours");
        if (!res.ok) throw new Error(`my-tours fetch failed: ${res.status}`);
        const data = await res.json() as Record<string, SavedTourEntry[]>;
        if (!cancelled) setSavedTours(data);
      } catch (e) {
        console.error("[tours-page] my-tours fetch failed", e);
        if (!cancelled) setSavedTours({});
      } finally {
        if (!cancelled) setLoadingTours(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLoadTour = (id: string) => {
    router.push(`/tour?id=${id}`);
  };

  const handleDelete = (id: string) => {
    setSavedTours(prev => {
      const updated = { ...prev };
      for (const key of Object.keys(updated)) {
        updated[key] = updated[key].filter(t => t.id !== id);
        if (updated[key].length === 0) delete updated[key];
      }
      return updated;
    });
  };

  const totalCount = Object.values(savedTours).reduce((sum, e) => sum + e.length, 0);
  if (!loadingTours && totalCount === 0) return null;

  return (
    <YourToursSection
      savedTours={savedTours}
      loadingTours={loadingTours}
      onLoadTour={handleLoadTour}
      onDelete={handleDelete}
    />
  );
}
