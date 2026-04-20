import { db } from "@/lib/db";
import type { FamilyProfile, Trip, FamilyMember } from "@prisma/client";

/**
 * Resolve a Clerk userId to a FamilyProfile id.
 *
 * Priority 1: ProfileMember explicit override (allows co-owners to share a profile)
 * Priority 2: User.clerkId → User.familyProfile.id (standard single-account path)
 *
 * This allows multiple Clerk accounts to share one FamilyProfile
 * (e.g. both parents on the same family account).
 */
export async function resolveProfileId(clerkUserId: string): Promise<string | null> {
  // Check for an explicit profile delegation first
  const member = await db.profileMember.findUnique({
    where: { clerkUserId },
    select: { familyProfileId: true },
  });
  if (member?.familyProfileId) return member.familyProfileId;

  // Fall back to the user's own profile
  const user = await db.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { familyProfile: { select: { id: true } } },
  });
  return user?.familyProfile?.id ?? null;
}

export type ProfileResolutionPath =
  | "profile_member"
  | "direct_user"
  | "delegate"
  | "none";

export type HydratedFamilyProfile = FamilyProfile & {
  trips: Trip[];
  members: FamilyMember[];
};

export type ResolveProfileByEmailResult = {
  familyProfile: HydratedFamilyProfile | null;
  path: ProfileResolutionPath;
};

/**
 * Resolve a FamilyProfile from an inbound email sender.
 * Mirrors the priority order of resolveProfileId(clerkUserId) so that the
 * webhook and the UI agree on which profile a given user belongs to.
 *
 * Priority:
 *   1. ProfileMember override on the sender's User (co-owner of another family)
 *   2. Sender's own FamilyProfile (the User they own)
 *   3. FamilyProfile where this email is a VERIFIED senderEmail (delegate)
 *   4. null
 *
 * Returns the hydrated FamilyProfile (with trips + members) so callers do not
 * need a second round-trip. The webhook's downstream code expects this shape.
 */
export async function resolveProfileByEmail(
  email: string
): Promise<ResolveProfileByEmailResult> {
  const senderEmail = email.toLowerCase().trim();
  if (!senderEmail) return { familyProfile: null, path: "none" };

  // Priority 1 + 2: look up the User and check ProfileMember first.
  const user = await db.user.findFirst({
    where: { email: senderEmail },
    select: { id: true, clerkId: true, familyProfile: { select: { id: true } } },
  });

  if (user) {
    // Priority 1: ProfileMember co-owner override.
    const member = await db.profileMember.findUnique({
      where: { clerkUserId: user.clerkId },
      select: { familyProfileId: true },
    });
    if (member?.familyProfileId) {
      const fp = await db.familyProfile.findUnique({
        where: { id: member.familyProfileId },
        include: { trips: true, members: true },
      });
      if (fp) return { familyProfile: fp, path: "profile_member" };
    }

    // Priority 2: User's own FamilyProfile.
    if (user.familyProfile?.id) {
      const fp = await db.familyProfile.findUnique({
        where: { id: user.familyProfile.id },
        include: { trips: true, members: true },
      });
      if (fp) return { familyProfile: fp, path: "direct_user" };
    }
  }

  // Priority 3: verified delegate sender.
  const delegate = await db.familyProfile.findFirst({
    where: {
      senderEmails: { has: senderEmail },
      senderEmailVerifications: {
        some: { email: senderEmail, verifiedAt: { not: null } },
      },
    },
    include: { trips: true, members: true },
  });
  if (delegate) return { familyProfile: delegate, path: "delegate" };

  return { familyProfile: null, path: "none" };
}
