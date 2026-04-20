import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CATEGORIES = ["Food", "Culture", "Outdoor", "Shopping", "Lodging", "Activity", "Other"];

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const spot = await db.communitySpot.findUnique({ where: { id }, select: { name: true, description: true, category: true, city: true } });
  if (!spot) return NextResponse.json({ error: "not found" }, { status: 404 });

  const prompt = `You are classifying a travel spot into one category.

Name: ${spot.name}
City: ${spot.city}
Description: ${spot.description ?? "(none)"}
Current category: ${spot.category ?? "(none)"}

Categories: ${CATEGORIES.join(", ")}

Respond with ONLY a JSON object: {"suggestedCategory": "<one of the above>", "confidence": <0 to 1>, "reason": "<one short sentence>"}`;

  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content[0].type === "text" ? res.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no json");
    const parsed = JSON.parse(jsonMatch[0]);
    if (!CATEGORIES.includes(parsed.suggestedCategory)) throw new Error("invalid category");
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: "classify failed", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
