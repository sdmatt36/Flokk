import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";

export type AiDestinationSuggestion = {
  name: string;
  country: string;
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json([], { status: 401 });

  const { query } = await req.json() as { query: string };
  if (!query?.trim() || query.length < 2) return NextResponse.json([]);

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: "You are a travel geography assistant. Return only valid JSON, no explanation, no markdown.",
      messages: [{
        role: "user",
        content: `The user typed: "${query}". Return up to 3 matching real-world travel destinations as a JSON array with this exact shape: [{"name":"string","country":"string"}]. Only return real places. If nothing matches return [].`,
      }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    const parsed = JSON.parse(text.replace(/```json?\n?/g, "").replace(/```/g, "").trim()) as AiDestinationSuggestion[];
    return NextResponse.json(Array.isArray(parsed) ? parsed.slice(0, 3) : []);
  } catch (e) {
    console.error("[destinations/ai-lookup] error:", e);
    return NextResponse.json([]);
  }
}
