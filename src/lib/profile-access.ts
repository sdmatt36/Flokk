import { db } from "@/lib/db";

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
