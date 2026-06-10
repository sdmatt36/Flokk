import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }

  const ids: string[] = body.ids.filter((id: unknown) => typeof id === "string");

  // Soft-delete: only rows that:
  //   1. belong to this profile
  //   2. are not assigned to a trip (tripId IS NULL)
  //   3. are not Google Maps imports (sourceMethod != "maps_import")
  const result = await db.savedItem.updateMany({
    where: {
      id: { in: ids },
      familyProfileId: profileId,
      tripId: null,
      NOT: { sourceMethod: "maps_import" },
    },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ deleted: result.count });
}
