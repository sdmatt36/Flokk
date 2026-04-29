import { CollaboratorRole } from '@prisma/client';

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

export async function sendInviteEmail(
  payload: InviteEmailPayload
): Promise<{ ok: boolean; error?: string }> {
  // STUB — Checkpoint 6 replaces with Resend + React Email template.
  console.log('[sendInviteEmail STUB]', JSON.stringify(payload, null, 2));
  return { ok: true };
}
