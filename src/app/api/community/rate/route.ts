import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { writeThroughCommunitySpot } from "@/lib/community-write-through";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ ratings: [] });

  const ratings = await db.placeRating.findMany({
    where: { familyProfileId: profileId },
    select: { id: true, placeName: true, rating: true, destinationCity: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ratings });
}

const BodySchema = z.object({
  placeName: z.string().min(1),
  destinationCity: z.string().optional().nullable(),
  destinationCountry: z.string().optional().nullable(),
  rating: z.number().int().min(1).max(5),
  notes: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  googlePlaceId: z.string().optional().nullable(),
  savedItemId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid body", details: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const newRating = await db.$transaction(async (tx) => {
      const created = await tx.placeRating.create({
        data: {
          familyProfileId: profileId,
          tripId: null,
          placeName: body.placeName.trim(),
          placeType: body.category ?? "activity",
          destinationCity: body.destinationCity?.trim() ?? "",
          rating: body.rating,
          notes: body.notes ?? null,
          savedItemId: body.savedItemId ?? null,
        },
      });

      await writeThroughCommunitySpot(tx, {
        name: body.placeName,
        city: body.destinationCity?.trim() ?? "",
        country: body.destinationCountry ?? null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        photoUrl: body.photoUrl ?? null,
        websiteUrl: body.websiteUrl ?? null,
        description: body.notes ?? null,
        category: body.category ?? null,
        googlePlaceId: body.googlePlaceId ?? null,
        authorProfileId: profileId,
        familyProfileId: profileId,
        rating: body.rating,
        note: body.notes ?? null,
      });

      return created;
    }, { timeout: 10000 });

    return NextResponse.json({ success: true, rating: newRating });
  } catch (e) {
    console.error("[/api/community/rate] POST error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
