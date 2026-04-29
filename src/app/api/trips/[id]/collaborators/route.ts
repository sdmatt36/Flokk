import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { resolveProfileByEmail } from "@/lib/profile-access";
import { canViewTrip, canManageCollaborators } from "@/lib/trip-permissions";
import { sendInviteEmail } from "@/emails/sendInvite";

export const dynamic = "force-dynamic";

// GET /api/trips/[id]/collaborators
// Returns all collaborators on the trip. Requires any accepted role.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  if (!(await canViewTrip(profileId, tripId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db.tripCollaborator.findMany({
    where: { tripId },
    include: {
      familyProfile: { select: { familyName: true } },
    },
    orderBy: [{ invitedAt: "asc" }],
  });

  // Sort: OWNER first, then by invitedAt
  const sorted = [...rows].sort((a, b) => {
    if (a.role === "OWNER" && b.role !== "OWNER") return -1;
    if (b.role === "OWNER" && a.role !== "OWNER") return 1;
    return 0;
  });

  const collaborators = sorted.map((row) => ({
    id: row.id,
    role: row.role,
    familyProfileId: row.familyProfileId,
    familyName: row.familyProfile?.familyName ?? null,
    invitedEmail: row.invitedEmail,
    invitedAt: row.invitedAt.toISOString(),
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
    isPending: row.acceptedAt === null,
    isYou: row.familyProfileId === profileId,
  }));

  return NextResponse.json({ collaborators });
}

// POST /api/trips/[id]/collaborators
// Invite a collaborator by email. Requires OWNER or EDITOR.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const body = await req.json() as { email?: unknown; role?: unknown };
  const { email, role } = body;

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (role !== "EDITOR" && role !== "VIEWER") {
    return NextResponse.json({ error: "role must be EDITOR or VIEWER" }, { status: 400 });
  }

  const inviteAction = role === "EDITOR" ? "INVITE_EDITOR" : "INVITE_VIEWER";
  if (!(await canManageCollaborators(profileId, tripId, inviteAction))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Look up whether this email already belongs to a Flokk profile
  const { familyProfile: existingProfile } = await resolveProfileByEmail(normalizedEmail);

  if (existingProfile) {
    // ── Instant-add path: the invitee already has a Flokk account ──

    // Block self-invite
    if (existingProfile.id === profileId) {
      return NextResponse.json({ error: "You're already on this trip as OWNER" }, { status: 400 });
    }

    // Check for duplicate accepted row
    const duplicate = await db.tripCollaborator.findUnique({
      where: { tripId_familyProfileId: { tripId, familyProfileId: existingProfile.id } },
    });
    if (duplicate) {
      return NextResponse.json({ error: "This person is already a collaborator", existing: duplicate }, { status: 409 });
    }

    const collab = await db.tripCollaborator.create({
      data: {
        tripId,
        familyProfileId: existingProfile.id,
        role,
        invitedEmail: normalizedEmail,
        invitedById: profileId,
        acceptedAt: new Date(),
      },
      include: { familyProfile: { select: { familyName: true } } },
    });

    return NextResponse.json({
      collaborator: {
        id: collab.id,
        role: collab.role,
        familyProfileId: collab.familyProfileId,
        familyName: collab.familyProfile?.familyName ?? null,
        invitedEmail: collab.invitedEmail,
        invitedAt: collab.invitedAt.toISOString(),
        acceptedAt: collab.acceptedAt ? collab.acceptedAt.toISOString() : null,
        isPending: false,
        isYou: false,
      },
    }, { status: 201 });
  }

  // ── Magic-link path: new user, not yet on Flokk ──

  // Check for duplicate pending invite to this email on this trip
  const pendingDuplicate = await db.tripCollaborator.findUnique({
    where: { tripId_invitedEmail: { tripId, invitedEmail: normalizedEmail } },
  });
  if (pendingDuplicate) {
    return NextResponse.json({ error: "An invitation is already pending for this email", existing: pendingDuplicate }, { status: 409 });
  }

  const token = nanoid(32);
  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invitations/${token}`;

  // Fetch trip + inviter name for the email
  const [trip, inviterProfile] = await Promise.all([
    db.trip.findUnique({
      where: { id: tripId },
      select: { title: true, destinationCity: true, startDate: true, endDate: true },
    }),
    db.familyProfile.findUnique({
      where: { id: profileId },
      select: { familyName: true },
    }),
  ]);

  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const collab = await db.tripCollaborator.create({
    data: {
      tripId,
      familyProfileId: null,
      role,
      invitedEmail: normalizedEmail,
      invitationToken: token,
      invitedById: profileId,
      acceptedAt: null,
    },
  });

  const emailResult = await sendInviteEmail({
    to: normalizedEmail,
    inviterFamilyName: inviterProfile?.familyName ?? null,
    tripTitle: trip.title,
    destinationCity: trip.destinationCity,
    startDate: trip.startDate,
    endDate: trip.endDate,
    role,
    acceptUrl,
  });

  if (!emailResult.ok) {
    // Roll back the invite row — don't leave an orphan token
    await db.tripCollaborator.delete({ where: { id: collab.id } });
    return NextResponse.json({ error: "Failed to send invitation email", detail: emailResult.error }, { status: 500 });
  }

  return NextResponse.json({
    collaborator: {
      id: collab.id,
      role: collab.role,
      familyProfileId: null,
      familyName: null,
      invitedEmail: collab.invitedEmail,
      invitedAt: collab.invitedAt.toISOString(),
      acceptedAt: null,
      isPending: true,
      isYou: false,
    },
  }, { status: 201 });
}

// DELETE /api/trips/[id]/collaborators
// Self-leave: caller removes themselves from the trip.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const body = await req.json() as { collaboratorId?: unknown };
  const { collaboratorId } = body;
  if (typeof collaboratorId !== "string") {
    return NextResponse.json({ error: "collaboratorId required" }, { status: 400 });
  }

  const row = await db.tripCollaborator.findUnique({ where: { id: collaboratorId } });
  if (!row || row.tripId !== tripId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.familyProfileId !== profileId) {
    return NextResponse.json({ error: "You can only remove yourself via this endpoint" }, { status: 403 });
  }

  // Block leaving if you're the sole OWNER
  if (row.role === "OWNER") {
    const otherOwners = await db.tripCollaborator.count({
      where: { tripId, role: "OWNER", id: { not: row.id }, acceptedAt: { not: null } },
    });
    if (otherOwners === 0) {
      return NextResponse.json(
        { error: "Owner cannot leave their own trip — delete the trip or transfer ownership first" },
        { status: 400 }
      );
    }
  }

  await db.tripCollaborator.delete({ where: { id: collaboratorId } });
  return NextResponse.json({ success: true });
}
