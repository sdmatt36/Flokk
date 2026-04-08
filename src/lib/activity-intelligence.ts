import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const VALID_TYPES = [
  "FOOD",
  "CULTURE",
  "OUTDOOR",
  "SHOPPING",
  "FAMILY",
  "SPORT",
  "ACTIVITY",
] as const;

type ActivityType = (typeof VALID_TYPES)[number];

export async function classifyActivityType(
  title: string,
  venueName?: string | null,
  address?: string | null
): Promise<ActivityType> {
  const description = [title, venueName, address].filter(Boolean).join(", ");

  try {
    const message = await getClient().messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: `Classify this travel activity into exactly one category. Reply with only the category word, nothing else.

Categories:
FOOD — restaurant, cafe, bar, market food stall, dining experience
CULTURE — museum, temple, shrine, gallery, historic site, landmark, palace, cultural district
OUTDOOR — beach, park, hike, nature walk, garden, mountain, viewpoint, waterfall
SHOPPING — mall, market, shop, boutique, street shopping
FAMILY — theme park, zoo, aquarium, children's attraction, amusement park
SPORT — stadium, sports game, match, arena, sporting event
ACTIVITY — everything else including tours, classes, experiences, cable car, observation deck

Activity: ${description}

Reply with one word only:`,
        },
      ],
    });

    const result = (
      message.content[0] as { type: string; text: string }
    ).text
      .trim()
      .toUpperCase();

    return VALID_TYPES.includes(result as ActivityType)
      ? (result as ActivityType)
      : "ACTIVITY";
  } catch {
    return "ACTIVITY";
  }
}

export async function classifyBatch(
  activities: Array<{
    id: string;
    title: string;
    venueName?: string | null;
    address?: string | null;
  }>
): Promise<Map<string, ActivityType>> {
  const results = new Map<string, ActivityType>();

  for (const act of activities) {
    const type = await classifyActivityType(
      act.title,
      act.venueName,
      act.address
    );
    results.set(act.id, type);
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return results;
}

export async function enrichActivityImage(
  title: string,
  city: string | null,
  type: string | null
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    // Build search query based on type
    let query = title;
    if (city) query += ` ${city}`;

    // For sports, search for the stadium/venue
    const isSport = type === "SPORT" ||
      /game|stadium|arena|match|baseball|football|soccer|basketball|cricket/i.test(title);
    if (isSport) query = `${title} stadium arena ${city ?? ""}`.trim();

    // Step 1 — Text search to get place_id
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    const photoRef = searchData.results?.[0]?.photos?.[0]?.photo_reference;
    if (!photoRef) return null;

    // Step 2 — Get photo URL and follow redirect to final lh3.googleusercontent.com URL
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${apiKey}`;
    const photoRes = await fetch(photoUrl, { redirect: "follow" });
    return photoRes.url ?? null;
  } catch {
    return null;
  }
}
