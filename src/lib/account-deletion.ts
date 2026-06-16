import { db } from "@/lib/db";

// The system profile that holds retained anonymized community content.
// Verify it exists before reassigning — if missing, the entire operation aborts.
const DEMO_PROFILE_ID = "cmmemrfz9000004kzgkk26f5f";

export interface DeleteAccountParams {
  userId: string;
  clerkId: string | null;
  skipClerk?: boolean;
}

export interface DeleteAccountResult {
  success: true;
  clerkPending?: boolean;
}

export async function deleteAccount({
  userId,
  clerkId,
  skipClerk = false,
}: DeleteAccountParams): Promise<DeleteAccountResult> {
  // Resolve profile id outside the transaction — early exit if the user has no profile.
  const profileRow = await db.familyProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profileRow) {
    throw new Error(`No FamilyProfile found for userId=${userId}`);
  }
  const profileId = profileRow.id;

  await db.$transaction(async (tx) => {
    // Guard: the demo profile must exist before we reassign anything to it.
    const demoExists = await tx.familyProfile.findUnique({
      where: { id: DEMO_PROFILE_ID },
      select: { id: true },
    });
    if (!demoExists) {
      throw new Error(
        `DEMO_PROFILE_ID ${DEMO_PROFILE_ID} not found — aborting account deletion`,
      );
    }

    // ── 1. Retain public tours ─────────────────────────────────────────────
    const publicTours = await tx.generatedTour.findMany({
      where: { familyProfileId: profileId, isPublic: true, deletedAt: null },
      select: { id: true, publicTitle: true, publicSubtitle: true },
    });
    for (const tour of publicTours) {
      // Scrub personal stop notes; keep publicWhy and publicFamilyNote.
      await tx.tourStop.updateMany({
        where: { tourId: tour.id },
        data: { why: null, familyNote: null },
      });
      // Scrub personal tour fields and reassign to the demo profile.
      await tx.generatedTour.update({
        where: { id: tour.id },
        data: {
          title: tour.publicTitle ?? "A Family Tour",
          subtitle: tour.publicSubtitle ?? null,
          prompt: "",
          inputStartPoint: null,
          inputGroup: null,
          inputVibe: [],
          familyProfileId: DEMO_PROFILE_ID,
        },
      });
    }

    // ── 2. Delete remaining tours (non-public or soft-deleted) ────────────
    // Public tours were already reassigned above, so only private/deleted remain.
    await tx.generatedTour.deleteMany({ where: { familyProfileId: profileId } });

    // ── 3. Retain public community spots ──────────────────────────────────
    await tx.communitySpot.updateMany({
      where: { authorProfileId: profileId, isPublic: true },
      data: { authorProfileId: DEMO_PROFILE_ID },
    });

    // ── 4. Delete remaining community spots (non-public) ──────────────────
    await tx.communitySpot.deleteMany({ where: { authorProfileId: profileId } });

    // ── 5. Delete place ratings ────────────────────────────────────────────
    // Must precede SavedItem cascade (NO ACTION on savedItemId) and Trip
    // deletion (RESTRICT on tripId) and FamilyProfile deletion (RESTRICT on
    // familyProfileId).
    await tx.placeRating.deleteMany({ where: { familyProfileId: profileId } });

    // ── 6. Delete itinerary items then trips ──────────────────────────────
    // ItineraryItem.tripId is SET NULL, so items orphan if the trip is deleted
    // first. Delete them explicitly before removing the trips.
    const trips = await tx.trip.findMany({
      where: { familyProfileId: profileId },
      select: { id: true },
    });
    const tripIds = trips.map((t) => t.id);
    if (tripIds.length > 0) {
      await tx.itineraryItem.deleteMany({ where: { tripId: { in: tripIds } } });
    }
    // Other trip children (ManualActivity, TripNote, PackingItem, etc.) cascade.
    await tx.trip.deleteMany({ where: { familyProfileId: profileId } });

    // ── 7. Delete FamilyProfile ────────────────────────────────────────────
    // Cascades: FamilyMember, SavedItem, DeclaredInterest, BehavioralProfile,
    // CommunityProfile, LoyaltyProgram, PaymentCard, ProfileMember,
    // SpotContribution, SenderEmailVerification, TripCollaborator.
    await tx.familyProfile.delete({ where: { id: profileId } });

    // ── 8. Delete User ─────────────────────────────────────────────────────
    await tx.user.delete({ where: { id: userId } });
  });

  // ── Post-transaction: delete Clerk user ───────────────────────────────────
  // Personal data is already gone. If Clerk deletion fails, log loudly and
  // return a flag — do not fail the request.
  let clerkPending = false;
  if (!skipClerk && clerkId) {
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const clerk = await clerkClient();
      await clerk.users.deleteUser(clerkId);
    } catch (err) {
      console.error(
        "[deleteAccount] WARN: DB deletion complete but Clerk cleanup failed.",
        "clerkId:", clerkId,
        "Error:", err,
      );
      clerkPending = true;
    }
  }

  return { success: true, ...(clerkPending && { clerkPending: true }) };
}
