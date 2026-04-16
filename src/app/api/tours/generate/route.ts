import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface TourStop {
  name: string;
  address: string;
  lat: number;
  lng: number;
  duration: number;
  why: string;
  familyNote: string;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { prompt: string; destinationCity: string; familyProfileId?: string };
  const { prompt, destinationCity } = body;

  if (!prompt || !destinationCity) {
    return NextResponse.json({ error: "prompt and destinationCity are required" }, { status: 400 });
  }

  try {
    const profileId = await resolveProfileId(userId);

    let familyContext = "";
    if (profileId) {
      const profile = await db.familyProfile.findUnique({
        where: { id: profileId },
        include: {
          members: {
            select: { name: true, role: true, dietaryRequirements: true },
          },
          interests: { select: { interestKey: true } },
        },
      });

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
    }

    const systemPrompt = `You are a family travel itinerary expert. Generate a themed day tour with 5–8 stops for the given destination and theme. Return ONLY valid JSON — no markdown, no preamble. Return an array of stops. Each stop must be:
{
  "name": string,
  "address": string (street address or landmark, as specific as possible),
  "lat": number (decimal degrees, as accurate as possible),
  "lng": number (decimal degrees, as accurate as possible),
  "duration": number (minutes to spend here),
  "why": string (one sentence on why this fits the theme),
  "familyNote": string (one practical tip for families, referencing the group if context provided)
}
Order stops logically by geography to minimize travel time. Use real, well-known places.`;

    const userMessage = `Theme: ${prompt}
Destination: ${destinationCity}${familyContext ? `\n${familyContext}` : ""}`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let stops: TourStop[] = [];
    try {
      const parsed = JSON.parse(cleaned);
      stops = Array.isArray(parsed) ? parsed : [];
    } catch {
      console.error("[tours/generate] JSON parse failed, raw:", raw.slice(0, 300));
      return NextResponse.json({ error: "Tour generation failed" }, { status: 500 });
    }

    // Geocoding fallback for stops where lat/lng is 0 or missing
    const geocodedStops = await Promise.all(
      stops.map(async (stop) => {
        if (stop.lat && stop.lng && stop.lat !== 0 && stop.lng !== 0) {
          return stop;
        }
        try {
          const query = encodeURIComponent(`${stop.name} ${stop.address} ${destinationCity}`);
          const geoRes = await fetch(
            `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${process.env.GOOGLE_MAPS_API_KEY}`
          );
          const geoData = await geoRes.json() as { results?: { geometry?: { location?: { lat: number; lng: number } } }[] };
          const location = geoData.results?.[0]?.geometry?.location;
          if (location) {
            return { ...stop, lat: location.lat, lng: location.lng };
          }
        } catch (e) {
          console.error("[tours/generate] geocoding fallback failed for stop:", stop.name, e);
        }
        return stop;
      })
    );

    return NextResponse.json({
      stops: geocodedStops,
      destinationCity,
      prompt,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[tours/generate] error:", err);
    return NextResponse.json({ error: "Tour generation failed" }, { status: 500 });
  }
}
