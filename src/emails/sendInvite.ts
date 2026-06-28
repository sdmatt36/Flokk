import { CollaboratorRole } from '@prisma/client';
import { render } from '@react-email/components';
import { sendEmail } from '@/lib/email';
import { inviterLabel } from '@/lib/inviter-label';
import InviteCollaborator from './InviteCollaborator';

export type InviteEmailPayload = {
  to: string;
  inviterFamilyName: string | null;
  tripTitle: string;
  destinationCity: string | null;
  startDate: Date | null;
  endDate: Date | null;
  role: CollaboratorRole;
  acceptUrl: string;
};

function roleLabel(role: CollaboratorRole): string {
  if (role === 'EDITOR') return 'an editor';
  if (role === 'VIEWER') return 'a viewer';
  return 'a collaborator';
}

// Renders the brand InviteCollaborator template and sends it through the shared Resend sender
// (src/lib/email.ts), which logs to EmailLog with a consistent FROM. Returns { ok } so the caller
// (POST /api/trips/[id]/collaborators) can roll back the invite row when the send fails.
export async function sendInviteEmail(
  payload: InviteEmailPayload
): Promise<{ ok: boolean; error?: string }> {
  const inviterName = inviterLabel(payload.inviterFamilyName);
  const subject = `${inviterName} invited you to plan ${payload.tripTitle} on Flokk`;

  const html = await render(
    InviteCollaborator({
      inviterName,
      tripTitle: payload.tripTitle,
      destinationCity: payload.destinationCity,
      roleLabel: roleLabel(payload.role),
      acceptUrl: payload.acceptUrl,
    })
  );

  const result = await sendEmail(payload.to, subject, html, 'collaborator_invite');
  return result.success ? { ok: true } : { ok: false, error: result.error };
}
