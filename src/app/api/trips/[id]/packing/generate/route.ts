import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;
    console.log("[packing/generate] START tripId:", tripId);

    const { userId } = await auth();
    if (!userId) {
      console.log("[packing/generate] Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[packing/generate] Auth OK userId:", userId);

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyProfile: {
          include: { members: true },
        },
      },
    });

    if (!user?.familyProfile) {
      console.log("[packing/generate] No family profile for userId:", userId);
      return NextResponse.json({ error: "No family profile" }, { status: 400 });
    }
    console.log("[packing/generate] Profile OK, members:", user.familyProfile.members.length);

    const trip = await db.trip.findUnique({ where: { id: tripId } });
    if (!trip || trip.familyProfileId !== user.familyProfile.id) {
      console.log("[packing/generate] Trip not found or unauthorized tripId:", tripId);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.log("[packing/generate] Trip fetched:", trip.destinationCity, trip.destinationCountry);

    const members = user.familyProfile.members ?? [];
    const memberSummary = members.length > 0
      ? members.map((m) => {
          const age = m.birthDate ? new Date().getFullYear() - new Date(m.birthDate).getFullYear() : null;
          return `${m.name ?? "member"}${age !== null ? ` (age ${age})` : ""}`;
        }).join(", ")
      : "family";

    const destination = [trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ") || "unknown destination";

    let dateContext = "";
    if (trip.startDate && trip.endDate) {
      const start = new Date(trip.startDate);
      const end = new Date(trip.endDate);
      const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const month = start.toLocaleString("en-US", { month: "long" });
      dateContext = `${nights} nights in ${month}`;
    } else if (trip.startDate) {
      const month = new Date(trip.startDate).toLocaleString("en-US", { month: "long" });
      dateContext = `departing in ${month}`;
    }

    const tripType = trip.tripType ?? "leisure";

    const prompt = `Generate a packing list for this trip as a JSON object.

Trip details:
- Destination: ${destination}
- Duration: ${dateContext || "unknown duration"}
- Trip type: ${tripType}
- Travelers: ${memberSummary}

Return exactly this structure:
{"items":[{"id":"kebab-slug","category":"Documents","name":"Item name","assignedTo":"Everyone","notes":""}]}

Categories (use exactly): Documents, Clothing, Toiletries, Kids, Tech, Health, Gear

Rules:
- Exactly 25 items total
- Tailor to destination climate, culture, and trip type
- Tailor to travelers (ages, kids' needs)
- Item name: max 40 characters
- assignedTo: traveler first name if person-specific, otherwise "Everyone"
- notes: null unless essential (e.g. "reef-safe recommended")
- No duplicate items`;

    console.log("[packing/generate] Calling Claude API, destination:", destination);
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      system: "You are a travel packing list generator. You respond ONLY with valid JSON. No markdown, no backticks, no explanation. Just the raw JSON object.",
      messages: [{ role: "user", content: prompt }],
    });
    console.log("[packing/generate] Claude responded, content blocks:", message.content.length);

    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
    console.log("[packing/generate] Raw text length:", rawText.length);

    const clean = rawText.trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[packing/generate] No JSON found in response:", rawText.slice(0, 300));
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    let parsed: { items: { id: string; category: string; name: string; assignedTo: string; notes: string }[] };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("[packing/generate] JSON.parse failed, attempting repair:", parseErr);
      const lastCompleteItem = jsonMatch[0].lastIndexOf("},");
      if (lastCompleteItem > 0) {
        const repaired = jsonMatch[0].substring(0, lastCompleteItem + 1) + "]}";
        try {
          parsed = JSON.parse(repaired);
          console.log("[packing/generate] JSON repaired, items:", parsed.items?.length);
        } catch (repairErr) {
          console.error("[packing/generate] JSON repair failed:", repairErr);
          return NextResponse.json({ error: "Invalid AI response JSON" }, { status: 500 });
        }
      } else {
        console.error("[packing/generate] No repairable JSON found, raw:", jsonMatch[0].slice(0, 200));
        return NextResponse.json({ error: "Invalid AI response JSON" }, { status: 500 });
      }
    }
    console.log("[packing/generate] Parsed items:", parsed.items?.length);

    await db.packingItem.deleteMany({ where: { tripId } });
    console.log("[packing/generate] Deleted existing items");

    await db.packingItem.createMany({
      data: parsed.items.map((item, index) => ({
        tripId,
        category: item.category,
        name: item.name,
        assignedTo: item.assignedTo === "all" ? "Everyone" : (item.assignedTo ?? "Everyone"),
        notes: item.notes || null,
        packed: false,
        sortOrder: index,
      })),
    });
    console.log("[packing/generate] Created", parsed.items.length, "items");

    return NextResponse.json({ generated: parsed.items.length });
  } catch (error) {
    console.error("[packing/generate] FAILED:", error);
    return NextResponse.json(
      { error: "Failed to generate packing list", details: String(error) },
      { status: 500 }
    );
  }
}
