export interface AddToItineraryPlace {
  name: string;
  city: string | null;
  country?: string | null;
  websiteUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  googlePlaceId?: string | null;
  photoUrl?: string | null;
  category?: string | null;
  sourceActivityId?: string | null;
}

export interface MatchingTrip {
  id: string;
  name: string;
  destinationCity: string | null;
  startDate: string | null;
  endDate: string | null;
  matchReason: "primary-city" | "itinerary-item-city";
}

export interface AddToItineraryResolveResponse {
  matches: MatchingTrip[];
}

/**
 * Fetch trips that match the given city.
 * Only returns trips that are upcoming or in-progress.
 */
export async function resolveMatchingTrips(city: string): Promise<MatchingTrip[]> {
  if (!city) return [];
  const res = await fetch(`/api/trips/match-by-city?city=${encodeURIComponent(city)}`);
  if (!res.ok) return [];
  const data: AddToItineraryResolveResponse = await res.json();
  return data.matches ?? [];
}

/**
 * Add a place to a trip's unscheduled Saves bucket (tripId set, no dayIndex).
 * Returns created save id on success.
 */
export async function addPlaceToTripSaves(
  place: AddToItineraryPlace,
  tripId: string | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/saves/from-share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: place.name,
        city: place.city ?? undefined,
        lat: place.lat ?? undefined,
        lng: place.lng ?? undefined,
        placePhotoUrl: place.photoUrl ?? undefined,
        websiteUrl: place.websiteUrl ?? undefined,
        tripId: tripId ?? undefined,
        category: place.category ?? undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      return { ok: false, error: data?.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: (e as Error)?.message ?? "Network error" };
  }
}
