import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";

export type AiActivityLookupResult = {
  address: string;
  website: string;
  latitude: number;
  longitude: number;
  confidence: "high" | "low";
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json(null, { status: 401 });

  const { activityName, city, country } = await req.json() as { activityName: string; city?: string; country?: string };
  if (!activityName?.trim() || activityName.length < 3) return NextResponse.json(null);

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const cityContext = [city, country].filter(Boolean).join(", ") || "unknown";
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: "You are a travel data assistant. Return only valid JSON, no other text.",
      messages: [{
        role: "user",
        content: `Return the most likely location data for this activity. Activity: ${activityName}. City: ${cityContext}. Return JSON only, no other text: { "address": string, "website": string, "latitude": number, "longitude": number, "confidence": "high" | "low" }. If you cannot find reliable data return confidence: "low" with empty strings for address/website but still attempt coordinates.`,
      }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "null";
    const parsed = JSON.parse(text.replace(/```json?\n?/g, "").replace(/```/g, "").trim()) as AiActivityLookupResult;
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("[activities/ai-lookup] error:", e);
    return NextResponse.json(null);
  }
}
