import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { DietaryReq, InterestCategory } from "@prisma/client";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

const INTEREST_CATEGORY_MAP: Record<string, InterestCategory> = {
  street_food: "FOOD", local_markets: "FOOD", fine_dining: "FOOD",
  food_tours: "FOOD", cooking_classes: "FOOD", cafes: "FOOD",
  hiking: "OUTDOOR", beaches: "OUTDOOR", national_parks: "OUTDOOR",
  cycling: "OUTDOOR", water_sports: "OUTDOOR", wildlife: "OUTDOOR",
  museums: "CULTURE", history: "CULTURE", art: "CULTURE",
  architecture: "CULTURE", local_festivals: "CULTURE", music: "CULTURE",
  theme_parks: "KIDS", playgrounds: "KIDS", zoos: "KIDS",
  educational: "KIDS", sports: "KIDS", hands_on: "KIDS",
  shows: "ENTERTAINMENT", sports_events: "ENTERTAINMENT", nightlife: "ENTERTAINMENT",
  movies: "ENTERTAINMENT", live_music: "ENTERTAINMENT", comedy_shows: "ENTERTAINMENT",
  seasonal_events: "ENTERTAINMENT", cinemas: "ENTERTAINMENT", escape_rooms: "ENTERTAINMENT",
  gaming_arcades: "ENTERTAINMENT", family_kids: "ENTERTAINMENT", kid_friendly: "ENTERTAINMENT",
  boutiques: "SHOPPING", vintage: "SHOPPING", souvenirs: "SHOPPING", antiques: "SHOPPING",
  spas: "WELLNESS", yoga: "WELLNESS", hot_springs: "WELLNESS", slow_travel: "WELLNESS",
  luxury: "STYLE", budget_travel: "STYLE", off_beaten_path: "STYLE",
  photography: "STYLE", road_trips: "STYLE", multi_generational: "STYLE",
};

function categoryForKey(key: string): InterestCategory {
  return INTEREST_CATEGORY_MAP[key] ?? "STYLE";
}

const MEMBER_SELECT = {
  id: true,
  name: true,
  role: true,
  birthDate: true,
  dietaryRequirements: true,
  foodAllergies: true,
  allergyNotes: true,
} as const;

export async function GET(_request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized", reason: "no-user" }, { status: 401, ...NO_STORE });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found", reason: "no-profile" }, { status: 404, ...NO_STORE });

  const familyProfile = await db.familyProfile.findUnique({
    where: { id: profileId },
    include: {
      members: {
        select: MEMBER_SELECT,
        orderBy: { createdAt: "asc" },
      },
      interests: {
        select: { interestKey: true },
      },
    },
  });
  if (!familyProfile) return NextResponse.json({ error: "Not found", reason: "no-profile-row" }, { status: 404, ...NO_STORE });

  return NextResponse.json({ familyProfile }, NO_STORE);
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized", reason: "no-user" }, { status: 401, ...NO_STORE });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found", reason: "no-profile" }, { status: 404, ...NO_STORE });

  const body = await request.json();

  // 1. Update scalar fields
  await db.familyProfile.update({
    where: { id: profileId },
    data: {
      ...(body.familyName !== undefined && { familyName: body.familyName || null }),
      ...(body.homeCity !== undefined && { homeCity: body.homeCity || null }),
      ...(body.state !== undefined && { state: body.state || null }),
      ...(body.homeCountry !== undefined && { homeCountry: body.homeCountry || null }),
      ...(body.favoriteAirports !== undefined && { favoriteAirports: body.favoriteAirports || null }),
      ...(body.travelFrequency && { travelFrequency: body.travelFrequency }),
      ...(body.budgetRange && { budgetRange: body.budgetRange }),
      ...(body.accessibilityNotes !== undefined && { accessibilityNotes: body.accessibilityNotes || null }),
    },
  });

  // 2. Per-id member reconcile: update existing, insert new, delete removed.
  //    Preserves all non-edited fields (passport, travel docs, etc.) on existing rows.
  if (Array.isArray(body.members)) {
    type IncomingMember = {
      id?: string;
      role: string;
      name?: string;
      birthDate?: string;
      dietaryRequirements?: string[];
      foodAllergies?: string[];
      allergyNotes?: string;
    };
    const incoming = body.members as IncomingMember[];
    const incomingIds = incoming.filter((m) => m.id).map((m) => m.id as string);

    // Delete members not present in the incoming set
    await db.familyMember.deleteMany({
      where: {
        familyProfileId: profileId,
        ...(incomingIds.length > 0 ? { id: { notIn: incomingIds } } : {}),
      },
    });

    for (const m of incoming) {
      const data = {
        name: m.name?.trim() || null,
        role: m.role as "ADULT" | "CHILD",
        birthDate: m.birthDate ? new Date(m.birthDate) : null,
        dietaryRequirements: (m.dietaryRequirements ?? []) as DietaryReq[],
        foodAllergies: m.foodAllergies ?? [],
        allergyNotes: m.allergyNotes?.trim() || null,
      };
      if (m.id) {
        await db.familyMember.update({ where: { id: m.id }, data });
      } else {
        await db.familyMember.create({ data: { ...data, familyProfileId: profileId } });
      }
    }
  }

  // 3. Interests: nuke-and-recreate. DeclaredInterest has no FK targets elsewhere.
  if (Array.isArray(body.interestKeys)) {
    await db.declaredInterest.deleteMany({ where: { familyProfileId: profileId } });
    const keys = body.interestKeys as string[];
    if (keys.length > 0) {
      await db.declaredInterest.createMany({
        data: keys.map((key) => ({
          interestKey: key,
          category: categoryForKey(key),
          tier: "SIGNUP" as const,
          weight: 1.0,
          familyProfileId: profileId,
        })),
      });
    }
  }

  // Return the complete updated profile so the client can refresh in one round-trip.
  const updated = await db.familyProfile.findUnique({
    where: { id: profileId },
    include: {
      members: {
        select: MEMBER_SELECT,
        orderBy: { createdAt: "asc" },
      },
      interests: { select: { interestKey: true } },
    },
  });

  return NextResponse.json({ familyProfile: updated }, NO_STORE);
}
