import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type OperatorPlanDay = {
  dayIndex: number;
  title: string;
  description: string;
  places: string[];
};

export type OperatorPlanLodging = {
  name: string;
  city: string | null;
  url: string | null;
  checkInDayIndex: number;
  nights: number;
};

export type OperatorPlanActivity = {
  name: string;
  dayIndex: number;
};

export type OperatorPlanResult = {
  tripTitle: string;
  destinationCountry: string | null;
  cities: string[];
  startDate: string | null;
  endDate: string | null;
  totalCost: number | null;
  currency: string | null;
  operatorName: string | null;
  operatorEmail: string | null;
  operatorPhone: string | null;
  operatorWebsite: string | null;
  days: OperatorPlanDay[];
  accommodations: OperatorPlanLodging[];
  bundledActivities: OperatorPlanActivity[];
  confidence: number;
};

const EXTRACT_TOOL = {
  name: "extract_operator_plan",
  description:
    "Extract structured data from a tour-operator email describing a multi-day trip plan. " +
    "Returns trip-level metadata, per-day itinerary segments, accommodations, and bundled activities.",
  input_schema: {
    type: "object" as const,
    properties: {
      tripTitle: { type: "string", description: "Short, human-readable trip title. Example: 'Morocco Desert Tour'." },
      destinationCountry: { type: ["string", "null"], description: "Primary country. Null if multi-country and no single dominant country." },
      cities: { type: "array", items: { type: "string" }, description: "All cities mentioned, in visit order. Example: ['Tangier', 'Fez', 'Merzouga', 'Marrakech']." },
      startDate: { type: ["string", "null"], description: "YYYY-MM-DD. Null if the email does not specify a concrete start date." },
      endDate: { type: ["string", "null"], description: "YYYY-MM-DD. Null if not specified." },
      totalCost: { type: ["number", "null"], description: "Total quote in the email's currency. Null if not specified." },
      currency: { type: ["string", "null"], description: "ISO currency code (USD, EUR, GBP, JPY, etc). Null if not specified." },
      operatorName: { type: ["string", "null"] },
      operatorEmail: { type: ["string", "null"] },
      operatorPhone: { type: ["string", "null"] },
      operatorWebsite: { type: ["string", "null"] },
      days: {
        type: "array",
        description: "One entry per day of the itinerary. dayIndex is zero-based.",
        items: {
          type: "object",
          properties: {
            dayIndex: { type: "number" },
            title: { type: "string", description: "Example: 'Day 1: Tangier to Chefchaouen to Fez'" },
            description: { type: "string", description: "Full prose of what happens that day." },
            places: { type: "array", items: { type: "string" }, description: "Specific named places visited that day." }
          },
          required: ["dayIndex", "title", "description", "places"]
        }
      },
      accommodations: {
        type: "array",
        description: "Each lodging mentioned. Match checkInDayIndex to the day guests arrive.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            city: { type: ["string", "null"] },
            url: { type: ["string", "null"], description: "Property URL if mentioned in the email." },
            checkInDayIndex: { type: "number" },
            nights: { type: "number" }
          },
          required: ["name", "checkInDayIndex", "nights"]
        }
      },
      bundledActivities: {
        type: "array",
        description: "Specific activities named in the email (camel trek, cooking class, etc). Optional.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            dayIndex: { type: "number" }
          },
          required: ["name", "dayIndex"]
        }
      },
      confidence: { type: "number", description: "0 to 1. Your confidence the email is a real multi-day operator plan." }
    },
    required: ["tripTitle", "cities", "days", "accommodations", "confidence"]
  }
};

export async function extractOperatorPlan(emailBody: string, subject: string): Promise<OperatorPlanResult | null> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "extract_operator_plan" },
      messages: [{
        role: "user",
        content: `Extract structured plan data from this tour-operator email. The email describes a multi-day trip with accommodations and activities. Decompose it into per-day segments, list each accommodation with the day the guest checks in, and capture operator contact details. If dates are not in the email, return null for startDate and endDate.

Subject: ${subject}

Body:
${emailBody}`
      }]
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      console.error("[operator-plan-extractor] no tool_use block in response");
      return null;
    }

    return toolUse.input as OperatorPlanResult;
  } catch (e) {
    console.error("[operator-plan-extractor] extraction failed:", e);
    return null;
  }
}

// Heuristic: does this email body look like a multi-day operator plan?
// Fires Path 2 when true AND Path 1 classified as "activity".
export function looksLikeOperatorPlan(rawBody: string): boolean {
  if (!rawBody || rawBody.length < 1500) return false;
  const signals = [
    /\bday\s+1\b/i.test(rawBody),
    /\bday\s+2\b/i.test(rawBody),
    /\bnight\s+1\b/i.test(rawBody),
    /\bitinerary\b/i.test(rawBody),
    (rawBody.match(/https?:\/\/[^\s]+/g) ?? []).length >= 2,
    /\b\d+\s*(day|night)s?\b/i.test(rawBody),
  ];
  return signals.filter(Boolean).length >= 2;
}
