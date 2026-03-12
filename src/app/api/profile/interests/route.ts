import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z, ZodError } from "zod";
import { InterestCategory } from "@prisma/client";

const Schema = z.object({
  interestKeys: z.array(z.string()).min(3),
});

function getCategoryForKey(key: string): InterestCategory {
  const map: Record<string, InterestCategory> = {
    street_food: "FOOD", local_markets: "FOOD", fine_dining: "FOOD",
    food_tours: "FOOD", cooking_classes: "FOOD", cafes: "FOOD",
    hiking: "OUTDOOR", beaches: "OUTDOOR", national_parks: "OUTDOOR",
    cycling: "OUTDOOR", water_sports: "OUTDOOR", wildlife: "OUTDOOR",
    museums: "CULTURE", history: "CULTURE", art: "CULTURE",
    architecture: "CULTURE", local_festivals: "CULTURE", music: "CULTURE",
    theme_parks: "KIDS", playgrounds: "KIDS", zoos: "KIDS",
    educational: "KIDS", sports: "KIDS", hands_on: "KIDS",
    shows: "ENTERTAINMENT", sports_events: "ENTERTAINMENT", nightlife: "ENTERTAINMENT", movies: "ENTERTAINMENT",
    boutiques: "SHOPPING", vintage: "SHOPPING", souvenirs: "SHOPPING", antiques: "SHOPPING",
    spas: "WELLNESS", yoga: "WELLNESS", hot_springs: "WELLNESS", slow_travel: "WELLNESS",
    luxury: "STYLE", budget_travel: "STYLE", off_beaten_path: "STYLE",
    photography: "STYLE", road_trips: "STYLE", multi_generational: "STYLE",
  };
  return map[key] ?? "STYLE";
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: { familyProfile: { include: { interests: true } } },
    });
    const interestKeys = user?.familyProfile?.interests.map((i) => i.interestKey) ?? [];
    return NextResponse.json({ interestKeys });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { interestKeys } = Schema.parse(body);

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: { familyProfile: true },
    });
    if (!user?.familyProfile) return NextResponse.json({ error: "No family profile" }, { status: 400 });

    const profileId = user.familyProfile.id;

    // Replace all interests
    await db.declaredInterest.deleteMany({ where: { familyProfileId: profileId } });
    await db.declaredInterest.createMany({
      data: interestKeys.map((key) => ({
        familyProfileId: profileId,
        interestKey: key,
        category: getCategoryForKey(key),
        tier: "SIGNUP" as const,
        weight: 1.0,
      })),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
