import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { textSearchPhoto } from "@/lib/google-places";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const url = new URL(req.url);
  const forceRefresh = url.searchParams.get("forceRefresh") === "true";

  const spot = await db.communitySpot.findUnique({
    where: { id },
    select: { id: true, name: true, city: true, country: true, category: true, photoUrl: true, address: true, websiteUrl: true, googlePlaceId: true },
  });
  if (!spot) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (spot.photoUrl && !forceRefresh) return NextResponse.json({ photoUrl: spot.photoUrl, cached: true });

  const contextLines = [
    `Name: ${spot.name}`,
    spot.city ? `City: ${spot.city}` : null,
    spot.country ? `Country: ${spot.country}` : null,
    spot.category ? `Category: ${spot.category}` : null,
    spot.address ? `Address: ${spot.address}` : null,
    spot.websiteUrl ? `Website: ${spot.websiteUrl}` : null,
    spot.googlePlaceId ? `Google Place ID: ${spot.googlePlaceId}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `You help find representative photos for travel spots. Given a spot, generate 3 specific Google Places text search queries that would return a relevant photo. Use address, website domain, and landmark specifics when present — these strongly disambiguate hotels, restaurants, and specific venues from generic results. Bias toward specific known landmarks, neighborhoods, or iconic features of the location. Avoid generic queries.

${contextLines}

Return ONLY a JSON object: {"queries": ["<query1>", "<query2>", "<query3>"]}`;

  let queries: string[] = [];
  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content[0].type === "text" ? res.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { queries?: unknown };
      if (Array.isArray(parsed.queries)) queries = (parsed.queries as unknown[]).slice(0, 3).map(String);
    }
  } catch {}

  // Fallback queries if Haiku fails
  if (queries.length === 0) {
    queries = [
      `${spot.name} ${spot.city}`,
      `${spot.category ?? "travel"} ${spot.city}`,
      `${spot.city} ${spot.country ?? ""}`.trim(),
    ];
  }

  for (const q of queries) {
    const photoUrl = await textSearchPhoto(q);
    if (photoUrl) {
      await db.communitySpot.update({
        where: { id: spot.id },
        data: { photoUrl },
      });
      return NextResponse.json({ photoUrl, query: q, resolved: true });
    }
  }

  return NextResponse.json({ photoUrl: null, resolved: false, queries });
}
