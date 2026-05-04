import crypto from "crypto";

// Bump this when deriveSegments, allocateRecCounts, or rec prompt assembly
// changes in a way that should invalidate all cached recs. Per Discipline 4.27.
const REC_CONTEXT_SCHEMA_VERSION = 2;

export type TripContext = {
  tripId: string;
  destinationCity: string;
  destinationCountry: string | null;
  lodgingLat: number | null;
  lodgingLng: number | null;
  itineraryItemIds: string[];
  savedItemIds: string[];
};

export function buildContextHash(ctx: TripContext): string {
  const normalized = [
    String(REC_CONTEXT_SCHEMA_VERSION),
    ctx.destinationCity.toLowerCase().trim(),
    ...ctx.itineraryItemIds.slice().sort(),
    ...ctx.savedItemIds.slice().sort(),
  ].join("|");
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export type HaikuContextExtras = {
  familyContext: string;
  plannedActivities: string[];
  savedForTrip: string[];
  lodgingAddress: string | null;
};

export function buildHaikuContextPrompt(ctx: TripContext, extras: HaikuContextExtras): string {
  const parts: string[] = [
    `Destination: ${ctx.destinationCity}${ctx.destinationCountry ? `, ${ctx.destinationCountry}` : ""}`,
  ];
  if (extras.lodgingAddress) {
    parts.push(`Lodging: ${extras.lodgingAddress}`);
  }
  if (extras.plannedActivities.length > 0) {
    parts.push(`Already planned (do not duplicate): ${extras.plannedActivities.join(", ")}`);
  }
  if (extras.savedForTrip.length > 0) {
    parts.push(`Already saved for this trip (do not duplicate): ${extras.savedForTrip.join(", ")}`);
  }
  if (extras.familyContext) {
    parts.push(extras.familyContext);
  }
  return parts.join("\n");
}
