import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const WINDOW_DAYS = 90;

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function hasHotelInVault(
  keyInfo: { label: string; value: string }[],
  documents: { label: string }[],
  savedItems: { categoryTags: string[] }[]
): boolean {
  const HOTEL_TERMS = /hotel|accommodation|airbnb|hostel|resort|villa|apartment|ryokan|inn|stay|lodging/i;
  return (
    keyInfo.some((k) => HOTEL_TERMS.test(k.label) || HOTEL_TERMS.test(k.value)) ||
    documents.some((d) => HOTEL_TERMS.test(d.label)) ||
    savedItems.some((s) => s.categoryTags.some((t) => HOTEL_TERMS.test(t)))
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      destinationCity: true,
      destinationCountry: true,
      startDate: true,
      endDate: true,
      bookingIntelCache: true,
      bookingIntelUpdatedAt: true,
      flights: { select: { id: true } },
      keyInfo: { select: { label: true, value: true } },
      documents: { select: { label: true } },
      savedItems: {
        where: { tripId: { not: undefined } },
        select: { rawTitle: true, categoryTags: true, isBooked: true },
      },
      manualActivities: {
        select: { title: true, status: true },
      },
    },
  });

  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Eligibility check
  if (!trip.startDate) return NextResponse.json({ show: false });
  const daysAway = daysUntil(trip.startDate);
  if (daysAway < 0 || daysAway > WINDOW_DAYS) return NextResponse.json({ show: false });

  const flightCount = trip.flights.length;
  const hotelBooked = hasHotelInVault(trip.keyInfo, trip.documents, trip.savedItems);
  const eligible = flightCount < 2 || !hotelBooked;
  if (!eligible) return NextResponse.json({ show: false });

  // Return cached response if fresh
  const cacheAge = trip.bookingIntelUpdatedAt
    ? Date.now() - trip.bookingIntelUpdatedAt.getTime()
    : Infinity;
  if (trip.bookingIntelCache && cacheAge < CACHE_TTL_MS) {
    return NextResponse.json({ show: true, items: trip.bookingIntelCache, daysAway });
  }

  // Build vault summary for Claude
  const vaultLines: string[] = [];
  if (flightCount > 0) vaultLines.push(`${flightCount} flight(s) saved`);
  else vaultLines.push("No flights saved");
  if (hotelBooked) vaultLines.push("Hotel/accommodation saved in vault");
  else vaultLines.push("No hotel saved");
  trip.keyInfo.forEach((k) => vaultLines.push(`Key info: ${k.label} = ${k.value}`));
  trip.documents.forEach((d) => vaultLines.push(`Document: ${d.label}`));
  trip.savedItems
    .filter((s) => s.rawTitle)
    .slice(0, 20)
    .forEach((s) => {
      const tags = s.categoryTags?.join(", ") || "";
      vaultLines.push(`Saved: ${s.rawTitle}${tags ? ` [${tags}]` : ""}`);
    });
  trip.manualActivities.slice(0, 10).forEach((a) => {
    vaultLines.push(`Activity: ${a.title} (${a.status})`);
  });

  const numberOfNights = trip.endDate && trip.startDate
    ? Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const startDateStr = trip.startDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const userPrompt =
    `A family is travelling to ${trip.destinationCity ?? "their destination"}, ` +
    `${trip.destinationCountry ?? ""} on ${startDateStr}` +
    (numberOfNights ? ` for ${numberOfNights} nights` : "") +
    `. Their trip vault contains:\n${vaultLines.join("\n")}\n\n` +
    `Return a JSON array of 3-5 things they should book or sort before they go, ` +
    `prioritised by urgency. Focus on things that sell out, require advance booking, ` +
    `or need to be done before departure.\n\n` +
    `For each item return:\n` +
    `{\n` +
    `  "title": string (short, action-oriented),\n` +
    `  "reason": string (1 sentence why it matters),\n` +
    `  "urgency": "now" | "soon" | "when ready",\n` +
    `  "bookingUrl": string | null (direct booking URL if universally applicable, otherwise null),\n` +
    `  "category": "flights" | "hotel" | "activities" | "documents" | "logistics"\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Never suggest something already in their vault\n` +
    `- If flights are missing, always include as #1 with urgency "now"\n` +
    `- If hotel is missing and trip is within 60 days, include with urgency "now"\n` +
    `- Be specific to the destination — e.g. for Japan suggest IC card and JR Pass, ` +
    `for Paris suggest Eiffel Tower tickets, for US national parks suggest timed entry permits\n` +
    `- Family context: account for kids needing separate tickets, family rooms, etc\n` +
    `- Return only the JSON array, no markdown, no explanation`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: "You are a family travel planning assistant. Return only valid JSON.",
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Strip any markdown code fences
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const items = JSON.parse(cleaned);

    if (!Array.isArray(items)) throw new Error("Not an array");

    // Persist to cache
    await db.trip.update({
      where: { id: tripId },
      data: { bookingIntelCache: items, bookingIntelUpdatedAt: new Date() },
    });

    return NextResponse.json({ show: true, items, daysAway });
  } catch {
    // Swallow — card hides on error
    return NextResponse.json({ show: false });
  }
}
