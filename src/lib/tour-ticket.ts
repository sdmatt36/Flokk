// Single source of truth for tour-stop ticket classification.
// Both the manual add path (tours/[id]/stops/route.ts) and tour generation
// (tours/generate/route.ts) import from here so the heuristic cannot drift again.

export type TicketSignal = "free" | "ticket-required" | "advance-booking-recommended" | "unknown";

export const TICKET_VALUES: readonly TicketSignal[] = [
  "free",
  "ticket-required",
  "advance-booking-recommended",
  "unknown",
];

export function isTicketSignal(v: unknown): v is TicketSignal {
  return typeof v === "string" && (TICKET_VALUES as readonly string[]).includes(v);
}

// Deterministic fallback used ONLY when the model returns "unknown" or its call/parse
// fails. Only STRONG signals decide; broad/ambiguous Google types (tourist_attraction,
// point_of_interest, landmark, neighborhood) deliberately resolve to "unknown" unless
// price_level or an editorial-summary keyword decides.
export function ticketFallbackFromSignals(
  types: string[],
  priceLevel: number | null | undefined,
  editorialSummary?: string | null,
): TicketSignal {
  const STRONG_FREE = ["park", "natural_feature", "beach"];
  const ADVANCE_TYPES = ["zoo", "aquarium", "amusement_park"];
  const STRONG_TICKET = ["museum", "art_gallery", "stadium", "movie_theater", "night_club"];

  if (types.some((t) => STRONG_FREE.includes(t))) return "free"; // strong-free wins outright
  if (types.some((t) => ADVANCE_TYPES.includes(t))) return "advance-booking-recommended";
  if (types.some((t) => STRONG_TICKET.includes(t))) return "ticket-required";
  if (priceLevel != null && priceLevel > 0) return "ticket-required";

  const summary = (editorialSummary ?? "").toLowerCase();
  if (summary.includes("free admission") || summary.includes("no admission")) return "free";
  if (summary.includes("admission") || summary.includes("ticket")) return "ticket-required";

  return "unknown";
}

// Shared classification instruction so the manual single-stop call and the batched
// generate call ask the model for ticketing the same way.
export function ticketClassificationGuidance(): string {
  return `Classify whether visiting this specific place normally requires a paid ticket or admission, using your knowledge of well-known attractions (for example: Shibuya Crossing and Yoyogi Park are free public spaces, while the Tokyo National Museum and the Statue of Liberty require a ticket). Answer with exactly one of: "free", "ticket-required", "advance-booking-recommended", "unknown". Use "advance-booking-recommended" for places that effectively require booking ahead (large zoos, aquariums, theme parks). If you are not confident, answer "unknown".`;
}
