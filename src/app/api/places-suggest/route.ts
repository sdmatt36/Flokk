import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json(null, { status: 401 });

  const { query, city, country } = await req.json() as { query: string; city?: string; country?: string };
  console.log("places-suggest hit:", { query, city, country });
  if (!query?.trim()) return NextResponse.json(null);

  // Try Google Places first
  if (GOOGLE_API_KEY) {
    const fullQuery = [query.trim(), city, country].filter(Boolean).join(", ");
    const fields = "name,formatted_address,website,geometry,photos";
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(fullQuery)}&inputtype=textquery&fields=${fields}&key=${GOOGLE_API_KEY}`;

    try {
      const res = await fetch(url);
      const data = await res.json() as {
        status: string;
        candidates: Array<{
          name: string;
          formatted_address: string;
          website?: string;
          geometry?: { location: { lat: number; lng: number } };
          photos?: Array<{ photo_reference: string }>;
        }>;
      };

      if (data.status === "OK" && data.candidates?.[0]) {
        const c = data.candidates[0];
        // Confidence check: result name shares at least one meaningful word with the query
        const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const nameWords = c.name.toLowerCase();
        const isConfident = queryWords.some(w => nameWords.includes(w));

        if (isConfident) {
          let photoUrl: string | null = null;
          if (c.photos?.[0]?.photo_reference) {
            photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=80&photoreference=${c.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`;
          }
          return NextResponse.json({
            name: c.name,
            address: c.formatted_address,
            website: c.website ?? null,
            lat: c.geometry?.location.lat ?? null,
            lng: c.geometry?.location.lng ?? null,
            photoUrl,
          });
        }
      }
    } catch { /* fall through to Claude */ }
  }

  // Claude fallback
  try {
    const anthropic = new Anthropic();
    const location = [city, country].filter(Boolean).join(", ") || "unknown location";
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: "Return only valid JSON, no explanation.",
      messages: [{
        role: "user",
        content: `What is the official website and full address for "${query}" in ${location}? Return: { "website": string|null, "address": string|null, "lat": number|null, "lng": number|null }`,
      }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const json = JSON.parse(text.replace(/```json?\n?/g, "").replace(/```/g, "").trim()) as {
      website?: string | null;
      address?: string | null;
      lat?: number | null;
      lng?: number | null;
    };

    if (json.website || json.address) {
      return NextResponse.json({
        name: query.trim(),
        address: json.address ?? null,
        website: json.website ?? null,
        lat: json.lat ?? null,
        lng: json.lng ?? null,
        photoUrl: null,
      });
    }
  } catch { /* ignore */ }

  return NextResponse.json(null);
}
