import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import Anthropic from "@anthropic-ai/sdk";
import { enrichWithPlaces } from "@/lib/enrich-with-places";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface RawStop {
  name: string;
  address: string;
  lat: number;
  lng: number;
  duration: number;
  travelTime: number;
  why: string;
  familyNote: string;
}

async function geocodeFallback(stop: RawStop, destinationCity: string): Promise<RawStop> {
  if (stop.lat && stop.lng && stop.lat !== 0 && stop.lng !== 0) return stop;
  try {
    const query = encodeURIComponent(`${stop.name} ${stop.address} ${destinationCity}`);
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const geoData = await geoRes.json() as { results?: { geometry?: { location?: { lat: number; lng: number } } }[] };
    const location = geoData.results?.[0]?.geometry?.location;
    if (location) {
      console.log(`[tour-geocode] "${stop.name}" fallback -> ${location.lat},${location.lng}`);
      return { ...stop, lat: location.lat, lng: location.lng };
    }
  } catch (e) {
    console.error("[tours/generate] geocoding fallback failed:", stop.name, e);
  }
  return stop;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    prompt: string;
    destinationCity: string;
    familyProfileId?: string;
    durationLabel?: string;
    transport?: string;
  };
  const { prompt, destinationCity } = body;
  const durationLabel = body.durationLabel ?? "";
  const transport = body.transport ?? "Walking";

  if (!prompt || !destinationCity) {
    return NextResponse.json({ error: "prompt and destinationCity are required" }, { status: 400 });
  }

  let maxMinutes: number;
  let targetStops: number;
  if (durationLabel === "2 hours") {
    maxMinutes = 120;
    targetStops = 3;
  } else if (durationLabel === "Full day (8 hrs)") {
    maxMinutes = 480;
    targetStops = 7;
  } else {
    maxMinutes = 240;
    targetStops = 5;
  }

  try {
    const profileId = await resolveProfileId(userId);
    if (!profileId) {
      return NextResponse.json({ error: "Family profile required to generate tours" }, { status: 400 });
    }

    const profile = await db.familyProfile.findUnique({
      where: { id: profileId },
      include: {
        members: { select: { name: true, role: true, dietaryRequirements: true } },
        interests: { select: { interestKey: true } },
      },
    });

    let familyContext = "";
    if (profile) {
      const memberList = profile.members
        .map(m => `${m.name ?? "Member"} (${m.role === "CHILD" ? "child" : "adult"})`)
        .join(", ");
      const interestList = profile.interests.map(i => i.interestKey).join(", ");
      const allDietary = [...new Set(profile.members.flatMap(m => m.dietaryRequirements as string[]))];
      const parts: string[] = [];
      if (memberList) parts.push(`Family: ${memberList}`);
      if (profile.travelStyle) parts.push(`Travel style: ${profile.travelStyle}`);
      if (profile.pace) parts.push(`Pace: ${profile.pace}`);
      if (interestList) parts.push(`Interests: ${interestList}`);
      if (allDietary.length > 0) parts.push(`Dietary notes: ${allDietary.join(", ")}`);
      familyContext = parts.join(". ");
    }

    // Fetch community-rated places for this destination
    const cityPattern = `%${destinationCity}%`;
    const [manualActivityRows, itineraryItemRows] = await Promise.all([
      db.$queryRaw<Array<{ id: string; title: string; address: string | null; lat: number | null; lng: number | null; imageUrl: string | null; avg_rating: number }>>`
        SELECT ma.id, ma.title, ma.address, ma.lat, ma.lng, ma."imageUrl", AVG(pr.rating)::float AS avg_rating
        FROM "ManualActivity" ma
        INNER JOIN "PlaceRating" pr ON pr."manualActivityId" = ma.id
        WHERE ma.city ILIKE ${cityPattern}
        GROUP BY ma.id, ma.title, ma.address, ma.lat, ma.lng, ma."imageUrl"
        ORDER BY avg_rating DESC
        LIMIT 20
      `,
      db.$queryRaw<Array<{ title: string; address: string | null; latitude: number | null; longitude: number | null; avg_rating: number }>>`
        SELECT ii.title, ii.address, ii.latitude, ii.longitude, AVG(pr.rating)::float AS avg_rating
        FROM "ItineraryItem" ii
        INNER JOIN "PlaceRating" pr ON pr."itineraryItemId" = ii.id
        WHERE ii."toCity" ILIKE ${cityPattern}
        GROUP BY ii.id, ii.title, ii.address, ii.latitude, ii.longitude
        ORDER BY avg_rating DESC
        LIMIT 10
      `,
    ]);

    const seededPlaces = [
      ...manualActivityRows.map(r => ({ name: r.title, address: r.address ?? "", lat: r.lat ?? 0, lng: r.lng ?? 0, avgRating: r.avg_rating })),
      ...itineraryItemRows.map(r => ({ name: r.title, address: r.address ?? "", lat: r.latitude ?? 0, lng: r.longitude ?? 0, avgRating: r.avg_rating })),
    ];

    const seededContext = seededPlaces.length > 0
      ? `Community-rated places in ${destinationCity} from real families (use these first when relevant):\n${seededPlaces.map(p => `${p.name} — ${p.address} (rated ${p.avgRating.toFixed(1)}/5)`).join("\n")}\n\n`
      : "";

    // Create GeneratedTour before streaming so TourStop rows can FK to it
    const tourId: string = crypto.randomUUID();
    const tourTitle = prompt.trim().length <= 10
      ? `${destinationCity} tour`
      : prompt.trim().slice(0, 60);
    await db.generatedTour.create({
      data: {
        id: tourId,
        title: tourTitle,
        destinationCity,
        destinationCountry: null,
        prompt,
        durationLabel,
        transport,
        familyProfileId: profileId,
        categoryTags: [],
      },
    });

    const emitTourStopTool: Anthropic.Tool = {
      name: "emit_tour_stop",
      description: `Emit one stop for the tour. Call this tool exactly ${targetStops} times, once per stop, in order.`,
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          address: { type: "string" },
          lat: { type: "number" },
          lng: { type: "number" },
          duration: { type: "number", description: "Minutes at this stop" },
          travelTime: { type: "number", description: "Minutes to travel to the NEXT stop, 0 for the last stop" },
          why: { type: "string", description: "One sentence on why this stop fits the theme" },
          familyNote: { type: "string", description: "Specific note for this family based on kids ages" },
        },
        required: ["name", "address", "lat", "lng", "duration", "travelTime", "why", "familyNote"],
      },
    };

    const systemPrompt = `You are a family travel expert building themed day tours. Call emit_tour_stop exactly ${targetStops} times — once per stop, in order. Stops must be geographically clustered for ${transport} travel — walking tours must have stops within 15 minutes walk of each other, metro tours can span the city, car tours have no distance constraint. Keep stops strictly on theme — do not add tangential attractions. Total time (sum of all duration + travelTime fields) must not exceed ${maxMinutes} minutes.`;

    const userMessage = `${seededContext}Tour theme: ${prompt}. Destination: ${destinationCity}. Duration: ${durationLabel || "Half day (4 hrs)"}. Transport: ${transport}. Family: ${familyContext || "not specified"}`;

    // Stream with tool_use — each complete tool call = one stop
    type PersistedStop = RawStop & { id: string; orderIndex: number };
    const completedStops: PersistedStop[] = [];
    const parallelPhotoFetches: Array<Promise<{ stopId: string; imageUrl: string | null }>> = [];
    let orderIndex = 0;
    let currentToolName: string | null = null;
    let currentToolJson = "";
    let partialTour = false;

    const stream = anthropic.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
      tools: [emitTourStopTool],
      tool_choice: { type: "tool", name: "emit_tour_stop" },
      messages: [{ role: "user", content: userMessage }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
        currentToolName = event.content_block.name;
        currentToolJson = "";
      } else if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
        currentToolJson += event.delta.partial_json;
      } else if (event.type === "content_block_stop" && currentToolName === "emit_tour_stop") {
        try {
          const rawStop = JSON.parse(currentToolJson) as RawStop;
          const stop = await geocodeFallback(rawStop, destinationCity);
          const stopId = crypto.randomUUID();
          const idx = orderIndex++;

          await db.tourStop.create({
            data: {
              id: stopId,
              tourId,
              orderIndex: idx,
              name: stop.name,
              address: stop.address || null,
              lat: stop.lat || null,
              lng: stop.lng || null,
              durationMin: stop.duration || null,
              travelTimeMin: stop.travelTime || null,
              why: stop.why || null,
              familyNote: stop.familyNote || null,
            },
          });

          completedStops.push({ ...stop, id: stopId, orderIndex: idx });

          // Photo fetch starts immediately — runs in parallel while next stop streams
          parallelPhotoFetches.push(
            enrichWithPlaces(stop.name, destinationCity)
              .then(({ imageUrl }) => ({ stopId, imageUrl: imageUrl ?? null }))
              .catch((e: unknown) => {
                console.log(`[tour-photo-err] "${stop.name}": ${e instanceof Error ? e.message : String(e)}`);
                return { stopId, imageUrl: null };
              })
          );
        } catch (e) {
          console.error("[tours/generate] failed to parse stop tool call:", e);
          partialTour = true;
        }
        currentToolName = null;
        currentToolJson = "";
      } else if (event.type === "message_stop") {
        console.log(`[tour-stream] complete: ${completedStops.length}/${targetStops} stops`);
      }
    }

    // Flag partial stream
    if (completedStops.length < targetStops) {
      partialTour = true;
      console.log(`[tour-stream] partial: got ${completedStops.length} of ${targetStops} requested`);
    }

    // Await all photo fetches — most already resolved by now
    const photoResults = await Promise.all(parallelPhotoFetches);
    const photoMap = new Map<string, string | null>();

    // Log results
    for (const { stopId, imageUrl } of photoResults) {
      photoMap.set(stopId, imageUrl);
      const stopName = completedStops.find(s => s.id === stopId)?.name ?? stopId;
      if (imageUrl) {
        console.log(`[tour-photo] "${stopName}" -> ${imageUrl.slice(0, 60)}`);
      } else {
        console.log(`[tour-photo-miss] "${stopName}"`);
      }
    }

    // Batch-update TourStop imageUrl for resolved photos
    const updates = photoResults
      .filter(r => r.imageUrl)
      .map(r => db.tourStop.update({ where: { id: r.stopId }, data: { imageUrl: r.imageUrl } }));
    await Promise.all(updates);

    return NextResponse.json({
      tourId,
      stops: completedStops.map(s => ({
        name: s.name,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        duration: s.duration,
        travelTime: s.travelTime,
        why: s.why,
        familyNote: s.familyNote,
        imageUrl: photoMap.get(s.id) ?? null,
      })),
      destinationCity,
      prompt,
      durationLabel,
      transport,
      generatedAt: new Date().toISOString(),
      ...(partialTour ? { partialTour: true } : {}),
    });

  } catch (err) {
    console.error("[tours/generate] error:", err);
    return NextResponse.json({ error: "Tour generation failed" }, { status: 500 });
  }
}
