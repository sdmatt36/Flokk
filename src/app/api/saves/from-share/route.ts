import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

function inferCategoryTagFromTitle(title: string): string[] {
  const t = title.toLowerCase();
  if (t.includes("restaurant") || t.includes("cafe") || t.includes("coffee") ||
      t.includes("bar") || t.includes("food") || t.includes("dining") ||
      t.includes("lunch") || t.includes("dinner") || t.includes("breakfast") ||
      t.includes("bistro") || t.includes("eatery") || t.includes("ramen") ||
      t.includes("sushi") || t.includes("pizza") || t.includes("bbq")) return ["food"];
  if (t.includes("hotel") || t.includes("hostel") || t.includes("lodging") ||
      t.includes("accommodation") || t.includes("resort") || t.includes("airbnb") ||
      t.includes("inn") || t.includes("ryokan") || t.includes("bnb")) return ["lodging"];
  if (t.includes("kid") || t.includes("child") || t.includes("family") ||
      t.includes("playground") || t.includes("zoo") || t.includes("aquarium") ||
      t.includes("theme park")) return ["kids"];
  if (t.includes("park") || t.includes("hike") || t.includes("trail") ||
      t.includes("beach") || t.includes("outdoor") || t.includes("nature") ||
      t.includes("mountain") || t.includes("garden")) return ["outdoor"];
  if (t.includes("shop") || t.includes("market") || t.includes("mall") ||
      t.includes("store") || t.includes("boutique")) return ["shopping"];
  if (t.includes("flight") || t.includes("train") || t.includes("bus") ||
      t.includes("transport") || t.includes("transit") || t.includes("airport")) return ["transportation"];
  if (t.includes("museum") || t.includes("gallery") || t.includes("temple") ||
      t.includes("palace") || t.includes("monument") || t.includes("historic") ||
      t.includes("shrine") || t.includes("castle") || t.includes("theater") ||
      t.includes("theatre") || t.includes("art")) return ["culture"];
  return [];
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
  }

  const body = await request.json() as {
    title?: string;
    city?: string | null;
    lat?: number | null;
    lng?: number | null;
    placePhotoUrl?: string | null;
    websiteUrl?: string | null;
    tripId?: string | null;
    category?: string | null;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  // Dedup by title within this family's saves
  const existing = await db.savedItem.findFirst({
    where: {
      familyProfileId: profileId,
      rawTitle: { equals: body.title.trim(), mode: "insensitive" },
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ saved: false, duplicate: true });
  }

  await db.savedItem.create({
    data: {
      familyProfileId: profileId,
      tripId: body.tripId ?? null,
      rawTitle: body.title.trim(),
      destinationCity: body.city ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      placePhotoUrl: body.placePhotoUrl ?? null,
      websiteUrl: body.websiteUrl ?? null,
      sourceMethod: "IN_APP_SAVE",
      sourcePlatform: "direct",
      status: body.tripId ? "TRIP_ASSIGNED" : "UNORGANIZED",
      extractionStatus: "ENRICHED",
      categoryTags: body.category ? [body.category] : inferCategoryTagFromTitle(body.title.trim()),
    },
  });

  return NextResponse.json({ saved: true }, { status: 201 });
}
