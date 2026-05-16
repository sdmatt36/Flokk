import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { nanoid } from "nanoid";

async function resolveProfileId(userId: string): Promise<string | null> {
  const profile = await db.familyProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await resolveProfileId(userId);
    if (!profileId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = (await request.json()) as { citySlug: string; scope: string };
    const { citySlug, scope } = body;

    if (!citySlug || !["imports", "all"].includes(scope)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Verify the city exists
    const city = await db.city.findUnique({
      where: { slug: citySlug },
      select: { id: true, name: true },
    });
    if (!city) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    // Upsert: idempotent by (ownerProfileId, citySlug, scope)
    let share = await db.cityShare.findFirst({
      where: { ownerProfileId: profileId, citySlug, scope },
      select: { token: true },
    });

    if (!share) {
      const token = nanoid(12);
      try {
        share = await db.cityShare.create({
          data: { token, ownerProfileId: profileId, citySlug, scope },
          select: { token: true },
        });
      } catch (e: unknown) {
        // P2002 = unique constraint race condition
        if ((e as { code?: string }).code === "P2002") {
          share = await db.cityShare.findFirst({
            where: { ownerProfileId: profileId, citySlug, scope },
            select: { token: true },
          });
        } else {
          throw e;
        }
      }
    }

    const host = request.headers.get("host") ?? "flokktravel.com";
    const protocol = host.includes("localhost") ? "http" : "https";
    const url = `${protocol}://${host}/share/city/${share!.token}`;

    return NextResponse.json({ token: share!.token, url });
  } catch (error) {
    console.error("[POST /api/saves/city-share]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
