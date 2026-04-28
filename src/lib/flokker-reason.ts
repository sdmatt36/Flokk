export type FamilyContext = {
  childAges: number[];
  pace: string | null;
  interests: string[];
};

type SpotInput = {
  name: string;
  destinationCity: string | null;
  avgRating: number;
  ratingCount: number;
};

export function buildFlokkerReason(spot: SpotInput, _familyContext: FamilyContext): string {
  // Workstream 4: cohort-weighted copy goes here — use familyContext.childAges and interests
  // to generate age-targeted or interest-targeted reason string.
  const city = spot.destinationCity ?? "the area";
  const families = spot.ratingCount === 1 ? "family" : "families";
  return `Rated ${spot.avgRating.toFixed(1)} by ${spot.ratingCount} Flokk ${families} in ${city}.`;
}
