import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function calcAge(birthDate: Date, referenceDate: Date): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const m = referenceDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && referenceDate.getDate() < birthDate.getDate())) age--;
  return age;
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const tripId = req.nextUrl.searchParams.get("tripId");
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!trip.destinationCity || trip.destinationCity.trim() === "") {
    return NextResponse.json({ recommendations: [], error: "no_destination" }, { status: 200 });
  }

  const profile = await db.familyProfile.findUnique({
    where: { id: profileId },
    include: {
      members: {
        select: {
          name: true,
          role: true,
          birthDate: true,
          dietaryRequirements: true,
          foodAllergies: true,
          mobilityNotes: true,
        },
      },
      interests: { select: { interestKey: true } },
    },
  });
  if (!profile) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const placeRatings = await db.placeRating.findMany({
    where: { familyProfileId: profileId },
    orderBy: { rating: "desc" },
    take: 5,
    select: { placeName: true, destinationCity: true, rating: true },
  });

  const recentSaves = await db.savedItem.findMany({
    where: { familyProfileId: profileId },
    select: { categoryTags: true },
    orderBy: { savedAt: "desc" },
    take: 100,
  });
  const catCount: Record<string, number> = {};
  for (const item of recentSaves) {
    for (const tag of item.categoryTags) {
      if (tag) catCount[tag] = (catCount[tag] ?? 0) + 1;
    }
  }
  const topCategories = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  const tripStart = trip.startDate ? new Date(trip.startDate) : new Date();
  const tripEnd   = trip.endDate   ? new Date(trip.endDate)   : tripStart;
  const durationDays = Math.max(1, Math.round((tripEnd.getTime() - tripStart.getTime()) / 86400000) + 1);

  const context = {
    destination: {
      city:    trip.destinationCity,
      country: trip.destinationCountry ?? null,
    },
    tripDates: {
      start:        trip.startDate?.toISOString().slice(0, 10) ?? null,
      end:          trip.endDate?.toISOString().slice(0, 10)   ?? null,
      durationDays,
    },
    family: {
      adults: profile.members
        .filter(m => m.role === "ADULT")
        .map(m => ({ name: m.name ?? "Adult" })),
      children: profile.members
        .filter(m => m.role === "CHILD")
        .map(m => ({
          name: m.name ?? "Child",
          age:  m.birthDate ? calcAge(m.birthDate, tripStart) : null,
        })),
      travelStyle:   profile.travelStyle   ?? null,
      pace:          profile.pace          ?? null,
      planningStyle: profile.planningStyle ?? null,
      budgetRange:   profile.budgetRange   ?? null,
      homeCountry:   profile.homeCountry   ?? null,
      interests:     profile.interests.map(i => i.interestKey),
      dietaryRequirements: [...new Set(
        profile.members.flatMap(m => m.dietaryRequirements as string[])
      )],
      foodAllergies: [...new Set(
        profile.members.flatMap(m => m.foodAllergies)
      )],
      mobilityNotes: profile.members
        .map(m => m.mobilityNotes)
        .filter((n): n is string => !!n),
      topSaveCategories: topCategories,
      lovedPlaces: placeRatings.map(r => ({
        title:  r.placeName,
        city:   r.destinationCity ?? null,
        rating: r.rating,
      })),
    },
  };

  const systemPrompt = `You are a family travel recommendation engine. You receive structured data about a real family and their destination. Return ONLY valid JSON -- no markdown, no preamble. Return an array of 10 recommendations. Each recommendation must be:
{
  "name": string,
  "category": string (one of: Food & Drink, Culture, Experiences, Nature, Adventure, Shopping, Lodging, Entertainment, Wellness),
  "whyThisFamily": string (one sentence, specific to this family's profile -- reference their ages, interests, or style),
  "ageAppropriate": boolean,
  "budgetTier": string (one of: Free, Budget, Mid, Premium, Luxury),
  "tip": string (one practical sentence a local would give),
  "tags": string[]
}
Base recommendations on the destination. Prioritize activities matching travelStyle, pace, and children ages. Exclude anything conflicting with dietary requirements or mobility notes. Weight toward categories matching topSaveCategories and lovedPlaces patterns.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: JSON.stringify(context, null, 2) }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  let recommendations: unknown[] = [];
  try {
    recommendations = JSON.parse(raw);
    if (!Array.isArray(recommendations)) recommendations = [];
  } catch {
    console.error("[recommendations/ai] JSON parse failed, raw:", raw.slice(0, 300));
    return NextResponse.json({ recommendations: [], context, error: "parse_failed" });
  }

  return NextResponse.json({ recommendations, context });
}
