import type { FamilyContext } from "./flokker-reason";

export type CommunitySpotPick = {
  id: string;
  name: string;
  destinationCity: string | null;
  lat: number | null;
  lng: number | null;
  avgRating: number;
  ratingCount: number;
  googlePlaceId: string | null;
  photoUrl: string | null;
};

export function rankRatedPicks(
  picks: CommunitySpotPick[],
  _familyContext: FamilyContext
): CommunitySpotPick[] {
  // Workstream 4: cohort-weighted sort goes here — boost picks where cohort ratings
  // from families with matching childAges or interests are high.
  return [...picks].sort((a, b) => b.avgRating - a.avgRating);
}
