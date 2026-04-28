import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z, ZodError } from "zod";
import { DietaryReq, InterestCategory } from "@prisma/client";

const MemberSchema = z.object({
  role: z.enum(["ADULT", "CHILD"]),
  name: z.string().optional(),
  birthDate: z.string().optional(),
  dietaryRequirements: z.array(z.nativeEnum(DietaryReq)),
  foodAllergies: z.array(z.string()).optional(),
  allergyNotes: z.string().optional(),
});

const OnboardingSchema = z.object({
  familyName: z.string().optional(),
  homeCity: z.string().min(1),
  homeCountry: z.string().min(1),
  travelFrequency: z.enum(["ONE_TWO", "THREE_FIVE", "SIX_PLUS"]),
  members: z.array(MemberSchema),
  interestKeys: z.array(z.string()).min(3),
});

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = OnboardingSchema.parse(body);

    // Find by clerkId first; if not found, upsert by email so existing accounts
    // get their clerkId re-linked instead of hitting a unique constraint crash.
    let user = await db.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      const clerkUser = await currentUser();
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${userId}@placeholder.flokk`;
      user = await db.user.upsert({
        where: { email },
        update: { clerkId: userId },
        create: { clerkId: userId, email },
      });
    }

    // Delete any existing family profile (re-onboarding support)
    await db.familyProfile.deleteMany({ where: { userId: user.id } });

    // Create family profile with members and interests
    const familyProfile = await db.familyProfile.create({
      data: {
        userId: user.id,
        familyName: data.familyName ?? null,
        homeCity: data.homeCity,
        homeCountry: data.homeCountry,
        travelFrequency: data.travelFrequency,
        members: {
          create: data.members.map((m) => ({
            name: m.name ?? null,
            role: m.role,
            birthDate: m.birthDate ? new Date(m.birthDate) : null,
            dietaryRequirements: m.dietaryRequirements,
            foodAllergies: m.foodAllergies ?? [],
            allergyNotes: m.allergyNotes ?? null,
          })),
        },
        interests: {
          create: data.interestKeys.map((key) => ({
            interestKey: key,
            category: getCategoryForKey(key),
            tier: "SIGNUP" as const,
            weight: 1.0,
          })),
        },
      },
    });

    return NextResponse.json({ success: true, familyProfileId: familyProfile.id });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Onboarding error:", JSON.stringify(error, Object.getOwnPropertyNames(error as object)));
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
    live_music: "ENTERTAINMENT", comedy_shows: "ENTERTAINMENT", seasonal_events: "ENTERTAINMENT",
    cinemas: "ENTERTAINMENT", escape_rooms: "ENTERTAINMENT", gaming_arcades: "ENTERTAINMENT",
    family_kids: "ENTERTAINMENT", kid_friendly: "ENTERTAINMENT",
    boutiques: "SHOPPING", vintage: "SHOPPING", souvenirs: "SHOPPING", antiques: "SHOPPING",
    spas: "WELLNESS", yoga: "WELLNESS", hot_springs: "WELLNESS", slow_travel: "WELLNESS",
    luxury: "STYLE", budget_travel: "STYLE", off_beaten_path: "STYLE",
    photography: "STYLE", road_trips: "STYLE", multi_generational: "STYLE",
  };
  return map[key] ?? "STYLE";
}
