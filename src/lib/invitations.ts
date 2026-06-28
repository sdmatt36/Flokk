import { db } from "@/lib/db";
import type { CollaboratorRole } from "@prisma/client";

export type InvitePreview = {
  tripId: string;
  tripTitle: string;
  destinationCity: string | null;
  startDate: string | null;
  endDate: string | null;
  inviterFamilyName: string | null;
  role: CollaboratorRole;
  isExpired: false;
};

// Single source of truth for the invitation-preview lookup, shared by the public GET route and
// the /invitations/[token] page so they can never drift. An invite is previewable only while it
// is still pending: no acceptedAt and no claiming familyProfileId. Once accepted, the POST route
// nulls invitationToken, so an accepted/declined token simply no longer resolves here.
export async function getInvitePreview(token: string): Promise<InvitePreview | null> {
  const row = await db.tripCollaborator.findUnique({
    where: { invitationToken: token },
    include: {
      trip: { select: { id: true, title: true, destinationCity: true, startDate: true, endDate: true } },
      invitedBy: { select: { familyName: true } },
    },
  });

  if (!row || row.acceptedAt !== null || row.familyProfileId !== null) {
    return null;
  }

  return {
    tripId: row.trip.id,
    tripTitle: row.trip.title,
    destinationCity: row.trip.destinationCity,
    startDate: row.trip.startDate ? row.trip.startDate.toISOString() : null,
    endDate: row.trip.endDate ? row.trip.endDate.toISOString() : null,
    inviterFamilyName: row.invitedBy?.familyName ?? null,
    role: row.role,
    isExpired: false,
  };
}
