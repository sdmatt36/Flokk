import { db } from "@/lib/db";
import { resolveGooglePhotoUrl } from "@/lib/google-places";
import Anthropic from "@anthropic-ai/sdk";

const FOOD_PLACE_TYPES = new Set(["restaurant", "meal_takeaway"]);

// Stops whose primary identity is NOT food even if Google tags them with food/restaurant
const PRIMARY_NON_FOOD_TYPES = new Set([
  "lodging", "tourist_attraction", "shopping_mall",
  "museum", "park", "amusement_park", "spa",
]);

type InsertResult =
  | { stop: { id: string; name: string; orderIndex: number } }
  | { error: string };

export async function addFoodStopToTour(
  tourId: string,
  familyProfileId: string
): Promise<InsertResult> {
  const tour = await db.generatedTour.findUnique({
    where: { id: tourId },
    select: {
      familyProfileId: true,
      destinationCity: true,
      stops: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        select: { id: true, orderIndex: true, placeTypes: true },
      },
    },
  });

  if (!tour) return { error: "Tour not found" };
  if (tour.familyProfileId !== familyProfileId) return { error: "Forbidden" };
  if (tour.stops.length < 2) return { error: "Tour needs at least 2 stops" };

  const alreadyHasFood = tour.stops.some(s => {
    const types = s.placeTypes as string[];
    return types.some(t => FOOD_PLACE_TYPES.has(t)) && !types.some(t => PRIMARY_NON_FOOD_TYPES.has(t));
  });
  if (alreadyHasFood) return { error: "Tour already has a meal stop" };

  const profile = await db.familyProfile.findUnique({
    where: { id: familyProfileId },
    select: {
      members: { select: { role: true, foodAllergies: true, dietaryRequirements: true } },
    },
  });

  const hasChildren = profile?.members.some(m => m.role === "CHILD") ?? false;
  const allAllergies = [
    ...new Set((profile?.members ?? []).flatMap(m => m.foodAllergies as string[])),
  ];
  const allDietary = [
    ...new Set((profile?.members ?? []).flatMap(m => m.dietaryRequirements as string[])),
  ];

  const lines: string[] = [
    `Recommend one specific, real restaurant in ${tour.destinationCity} for a walking tour meal stop.`,
  ];
  if (allAllergies.length > 0)
    lines.push(`Hard constraint — avoid any restaurant that serves or cross-contaminates: ${allAllergies.join(", ")}.`);
  if (allDietary.length > 0)
    lines.push(`Dietary preferences: ${allDietary.join(", ")}.`);
  if (hasChildren)
    lines.push("Family has children — choose a restaurant welcoming to kids.");
  lines.push(
    `Respond with a JSON object only, no markdown:\n{"name": "<exact restaurant name>", "why": "<one sentence why this is a great pick>", "familyNote": "<one short phrase for the family>"}`
  );

  let restaurantName = "";
  let why = "";
  let familyNote = "";

  try {
    const anthropic = new Anthropic();
    const aiResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [{ role: "user", content: lines.join("\n") }],
    });
    const text = aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as { name?: string; why?: string; familyNote?: string };
    restaurantName = parsed.name?.trim() ?? "";
    why = parsed.why?.trim() ?? "";
    familyNote = parsed.familyNote?.trim() ?? "";
  } catch {
    return { error: "Could not generate restaurant recommendation" };
  }

  if (!restaurantName) return { error: "AI did not return a restaurant name" };

  const gKey = process.env.GOOGLE_MAPS_API_KEY;
  let lat: number | null = null;
  let lng: number | null = null;
  let address: string | null = null;
  let placeId: string | null = null;
  let imageUrl: string | null = null;
  let websiteUrl: string | null = null;
  const placeTypes: string[] = [];

  if (gKey) {
    try {
      const query = `${restaurantName} ${tour.destinationCity}`;
      const searchRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${gKey}`
      );
      const searchData = (await searchRes.json()) as {
        results?: Array<{
          place_id: string;
          formatted_address?: string;
          geometry?: { location: { lat: number; lng: number } };
          types?: string[];
        }>;
      };
      const first = searchData.results?.[0];
      if (first) {
        placeId = first.place_id;
        address = first.formatted_address ?? null;
        lat = first.geometry?.location.lat ?? null;
        lng = first.geometry?.location.lng ?? null;
        placeTypes.push(...(first.types ?? []));

        const detailsRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,photos&key=${gKey}`
        );
        const detailsData = (await detailsRes.json()) as {
          result?: {
            website?: string;
            photos?: Array<{ photo_reference: string }>;
          };
        };
        websiteUrl = detailsData.result?.website ?? null;
        const photoRef = detailsData.result?.photos?.[0]?.photo_reference ?? null;
        if (photoRef) {
          const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${gKey}`;
          imageUrl = await resolveGooglePhotoUrl(photoApiUrl);
        }
      }
    } catch {
      // Place lookup is best-effort; stop will still be inserted with null spatial data
    }
  }

  // Insert after ~40% of the tour — never first, never last
  const insertAt = Math.max(1, Math.floor(tour.stops.length * 0.4));
  const stopsToShift = tour.stops.filter(s => s.orderIndex >= insertAt);
  await Promise.all(
    stopsToShift.map(s =>
      db.tourStop.update({
        where: { id: s.id },
        data: { orderIndex: s.orderIndex + 1 },
      })
    )
  );

  const newStopId = crypto.randomUUID();
  const newStop = await db.tourStop.create({
    data: {
      id: newStopId,
      tourId,
      orderIndex: insertAt,
      name: restaurantName,
      address,
      lat,
      lng,
      durationMin: 60,
      travelTimeMin: null,
      why: why || null,
      familyNote: familyNote || null,
      imageUrl,
      websiteUrl,
      placeId,
      ticketRequired: "free",
      placeTypes,
    },
  });

  return { stop: { id: newStop.id, name: newStop.name, orderIndex: newStop.orderIndex } };
}
