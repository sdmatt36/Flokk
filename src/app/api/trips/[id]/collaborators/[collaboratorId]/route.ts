import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { canManageCollaborators } from "@/lib/trip-permissions";

export const dynamic = "force-dynamic";

// PATCH /api/trips/[id]/collaborators/[collaboratorId]
// Change a collaborator's role. Requires OWNER.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; collaboratorId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, collaboratorId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  if (!(await canManageCollaborators(profileId, tripId, 'CHANGE_ROLE'))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as { role?: unknown };
  const { role } = body;
  if (role !== "EDITOR" && role !== "VIEWER") {
    return NextResponse.json({ error: "role must be EDITOR or VIEWER" }, { status: 400 });
  }

  const row = await db.tripCollaborator.findUnique({ where: { id: collaboratorId } });
  if (!row || row.tripId !== tripId) {
    return NextResponse.json({ error: "Collaborator not found" }, { status: 404 });
  }

  // Block self-demotion if caller is the sole OWNER
  if (row.familyProfileId === profileId && row.role === "OWNER") {
    const otherOwners = await db.tripCollaborator.count({
      where: { tripId, role: "OWNER", id: { not: row.id }, acceptedAt: { not: null } },
    });
    if (otherOwners === 0) {
      return NextResponse.json({ error: "Cannot demote yourself as the sole owner" }, { status: 400 });
    }
  }

  const updated = await db.tripCollaborator.update({
    where: { id: collaboratorId },
    data: { role },
    include: { familyProfile: { select: { familyName: true } } },
  });

  return NextResponse.json({
    collaborator: {
      id: updated.id,
      role: updated.role,
      familyProfileId: updated.familyProfileId,
      familyName: updated.familyProfile?.familyName ?? null,
      invitedEmail: updated.invitedEmail,
      acceptedAt: updated.acceptedAt ? updated.acceptedAt.toISOString() : null,
      isPending: updated.acceptedAt === null,
    },
  });
}

// DELETE /api/trips/[id]/collaborators/[collaboratorId]
// Remove a collaborator from the trip. Requires OWNER.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; collaboratorId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, collaboratorId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  if (!(await canManageCollaborators(profileId, tripId, 'REMOVE'))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = await db.tripCollaborator.findUnique({ where: { id: collaboratorId } });
  if (!row || row.tripId !== tripId) {
    return NextResponse.json({ error: "Collaborator not found" }, { status: 404 });
  }

  // Block removing self if sole OWNER
  if (row.familyProfileId === profileId && row.role === "OWNER") {
    const otherOwners = await db.tripCollaborator.count({
      where: { tripId, role: "OWNER", id: { not: row.id }, acceptedAt: { not: null } },
    });
    if (otherOwners === 0) {
      return NextResponse.json({ error: "Cannot remove yourself as the sole owner" }, { status: 400 });
    }
  }

  await db.tripCollaborator.delete({ where: { id: collaboratorId } });
  return NextResponse.json({ success: true });
}
