import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getOrCreateShareToken, ShareEntityType } from "@/lib/share-token";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const body = await req.json();
  const { entityType, entityId } = body as { entityType: ShareEntityType; entityId: string };

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 });
  }

  // Verify ownership before generating token
  const permitted = await checkPermission(profileId, entityType, entityId);
  if (!permitted) {
    return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });
  }

  const token = await getOrCreateShareToken(entityType, entityId);
  return NextResponse.json({ token });
}

async function checkPermission(
  profileId: string,
  entityType: ShareEntityType,
  entityId: string
): Promise<boolean> {
  switch (entityType) {
    case "saved_item": {
      const item = await db.savedItem.findUnique({
        where: { id: entityId },
        select: { familyProfileId: true, deletedAt: true },
      });
      return item?.familyProfileId === profileId && !item?.deletedAt;
    }

    case "itinerary_item": {
      const item = await db.itineraryItem.findUnique({
        where: { id: entityId },
        select: { tripId: true, familyProfileId: true },
      });
      if (!item) return false;
      if (item.familyProfileId === profileId) return true;
      if (!item.tripId) return false;
      const collab = await db.tripCollaborator.findFirst({
        where: { tripId: item.tripId, familyProfileId: profileId, acceptedAt: { not: null } },
        select: { id: true },
      });
      return collab !== null;
    }

    case "manual_activity": {
      const item = await db.manualActivity.findUnique({
        where: { id: entityId },
        select: { tripId: true, deletedAt: true },
      });
      if (!item || item.deletedAt) return false;
      const collab = await db.tripCollaborator.findFirst({
        where: { tripId: item.tripId, familyProfileId: profileId, acceptedAt: { not: null } },
        select: { id: true },
      });
      return collab !== null;
    }

    case "generated_tour": {
      const item = await db.generatedTour.findUnique({
        where: { id: entityId },
        select: { familyProfileId: true, deletedAt: true },
      });
      return item?.familyProfileId === profileId && !item?.deletedAt;
    }
  }
}
