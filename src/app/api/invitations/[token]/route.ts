import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

// GET /api/invitations/[token]
// Preview an invitation. Public — no auth required.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const row = await db.tripCollaborator.findUnique({
    where: { invitationToken: token },
    include: {
      trip: { select: { id: true, title: true, destinationCity: true, startDate: true, endDate: true } },
      invitedBy: { select: { familyName: true } },
    },
  });

  if (!row || row.acceptedAt !== null || row.familyProfileId !== null) {
    return NextResponse.json({ error: "Invitation expired or already accepted" }, { status: 410 });
  }

  return NextResponse.json({
    tripId: row.trip.id,
    tripTitle: row.trip.title,
    destinationCity: row.trip.destinationCity,
    startDate: row.trip.startDate ? row.trip.startDate.toISOString() : null,
    endDate: row.trip.endDate ? row.trip.endDate.toISOString() : null,
    inviterFamilyName: row.invitedBy?.familyName ?? null,
    role: row.role,
    isExpired: false,
  });
}

// POST /api/invitations/[token]
// Accept an invitation. Requires Clerk auth + a FamilyProfile.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) {
    return NextResponse.json({ error: "Sign up first" }, { status: 400 });
  }

  const row = await db.tripCollaborator.findUnique({
    where: { invitationToken: token },
  });

  if (!row || row.acceptedAt !== null || row.familyProfileId !== null) {
    return NextResponse.json({ error: "Invitation expired or already accepted" }, { status: 410 });
  }

  // Block double-accept: caller already has a collaborator row on this trip
  const existingRow = await db.tripCollaborator.findUnique({
    where: { tripId_familyProfileId: { tripId: row.tripId, familyProfileId: profileId } },
  });
  if (existingRow) {
    // Clean up the stale token row and redirect the client to the trip
    await db.tripCollaborator.delete({ where: { id: row.id } });
    return NextResponse.json({ tripId: row.tripId, role: existingRow.role });
  }

  const updated = await db.tripCollaborator.update({
    where: { id: row.id },
    data: {
      familyProfileId: profileId,
      acceptedAt: new Date(),
      invitationToken: null,
    },
  });

  return NextResponse.json({ tripId: updated.tripId, role: updated.role });
}
