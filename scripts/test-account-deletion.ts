// Test harness for deleteAccount().
// Run: npx tsx --tsconfig tsconfig.scripts.json scripts/test-account-deletion.ts
// Requires .env.local with DATABASE_URL.
//
// NEVER targets the real owner account. Guards are below.
//
// Dynamic imports are used inside main() so that @/lib/db is not initialized
// until after dotenv.config() has set DATABASE_URL. Static imports of those
// modules would be hoisted before dotenv runs.
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// ── Safety constants ──────────────────────────────────────────────────────────
const REAL_CLERK_ID = "user_3B68dQIbRRU8GZnMcSaoJwBg9GS";
const REAL_PROFILE_ID = "cmmmv15y7000104jvocfz5kt6";
const DEMO_PROFILE_ID = "cmmemrfz9000004kzgkk26f5f";

// ── Assertion helpers ─────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Load db and deleteAccount after dotenv has set DATABASE_URL.
  const { db } = await import("@/lib/db");
  const { deleteAccount } = await import("@/lib/account-deletion");

  console.log("=== deleteAccount test ===\n");

  // Look up the real owner — stored only for collision checks below.
  const realUser = await db.user.findFirst({
    where: { clerkId: REAL_CLERK_ID },
    select: { id: true },
  });

  // Verify the demo profile exists.
  const demoProfile = await db.familyProfile.findUnique({
    where: { id: DEMO_PROFILE_ID },
    select: { id: true },
  });
  if (!demoProfile) {
    console.error(`ABORT: DEMO_PROFILE_ID ${DEMO_PROFILE_ID} not found in DB.`);
    process.exit(1);
  }

  // ── Seed ─────────────────────────────────────────────────────────────────
  const ts = Date.now();
  const prefix = `testdel_${ts}`;

  console.log(`Seeding test data (prefix=${prefix})...`);

  // Throwaway user + profile
  const testUser = await db.user.create({
    data: {
      clerkId: `test_clerk_${ts}`,
      email: `${prefix}@test.invalid`,
    },
  });
  const testProfile = await db.familyProfile.create({
    data: { userId: testUser.id },
  });

  // Safety: abort if test ids collide with any protected account.
  if (
    testUser.id === realUser?.id ||
    testProfile.id === REAL_PROFILE_ID ||
    testProfile.id === DEMO_PROFILE_ID
  ) {
    console.error("ABORT: test user/profile id collides with a protected account.");
    await db.user.delete({ where: { id: testUser.id } }).catch(() => {});
    process.exit(1);
  }

  // Public tour with two stops (why + familyNote set)
  const publicTourId = `${prefix}_pub_tour`;
  await db.generatedTour.create({
    data: {
      id: publicTourId,
      title: "Test Public Tour",
      destinationCity: "Tokyo",
      prompt: "original prompt text",
      durationLabel: "4 hours",
      transport: "walking",
      familyProfileId: testProfile.id,
      isPublic: true,
      publicTitle: "Public Title Scrubbed",
      publicSubtitle: "Public Subtitle Kept",
    },
  });
  const stopId1 = `${prefix}_stop1`;
  const stopId2 = `${prefix}_stop2`;
  await db.tourStop.createMany({
    data: [
      {
        id: stopId1,
        tourId: publicTourId,
        orderIndex: 0,
        name: "Stop One",
        why: "personal why 1",
        familyNote: "personal family note 1",
        publicWhy: "public why 1",
        publicFamilyNote: "public family note 1",
      },
      {
        id: stopId2,
        tourId: publicTourId,
        orderIndex: 1,
        name: "Stop Two",
        why: "personal why 2",
        familyNote: "personal family note 2",
        publicWhy: "public why 2",
        publicFamilyNote: "public family note 2",
      },
    ],
  });

  // Private tour (should be deleted entirely)
  const privateTourId = `${prefix}_priv_tour`;
  await db.generatedTour.create({
    data: {
      id: privateTourId,
      title: "Test Private Tour",
      destinationCity: "Tokyo",
      prompt: "private prompt",
      durationLabel: "2 hours",
      transport: "walking",
      familyProfileId: testProfile.id,
      isPublic: false,
    },
  });
  await db.tourStop.create({
    data: {
      id: `${prefix}_priv_stop`,
      tourId: privateTourId,
      orderIndex: 0,
      name: "Private Stop",
      why: "private why",
      familyNote: "private note",
    },
  });

  // Public community spot (should be reassigned to demo)
  const publicSpot = await db.communitySpot.create({
    data: {
      name: `${prefix} Public Spot`,
      city: "Tokyo",
      authorProfileId: testProfile.id,
      isPublic: true,
    },
  });

  // Private community spot (should be deleted)
  const privateSpot = await db.communitySpot.create({
    data: {
      name: `${prefix} Private Spot`,
      city: "Tokyo",
      authorProfileId: testProfile.id,
      isPublic: false,
    },
  });

  // Trip
  const testTrip = await db.trip.create({
    data: {
      title: `${prefix} Trip`,
      familyProfileId: testProfile.id,
    },
  });

  // PlaceRating (references both familyProfile and trip — tests RESTRICT ordering)
  const testRating = await db.placeRating.create({
    data: {
      familyProfileId: testProfile.id,
      tripId: testTrip.id,
      placeName: "Test Place",
      placeType: "restaurant",
      rating: 4,
    },
  });

  // ItineraryItem on the trip (SET NULL on tripId — must be deleted explicitly)
  const testItinItem = await db.itineraryItem.create({
    data: {
      tripId: testTrip.id,
      familyProfileId: testProfile.id,
      type: "ACTIVITY",
      title: "Test Activity",
    },
  });

  // ManualActivity on the trip (CASCADE from trip — deleted implicitly with trip)
  const testManualActivity = await db.manualActivity.create({
    data: {
      tripId: testTrip.id,
      title: "Test Manual Activity",
      date: "2026-08-01",
    },
  });

  console.log(`  user=${testUser.id} profile=${testProfile.id}`);
  console.log(`  publicTour=${publicTourId}  privateTour=${privateTourId}`);
  console.log(`  publicSpot=${publicSpot.id}  privateSpot=${privateSpot.id}`);
  console.log(`  rating=${testRating.id}  trip=${testTrip.id}`);
  console.log(`  itinItem=${testItinItem.id}  manualActivity=${testManualActivity.id}`);
  console.log();

  // ── Run ───────────────────────────────────────────────────────────────────
  console.log("Running deleteAccount...");
  try {
    await deleteAccount({ userId: testUser.id, clerkId: null, skipClerk: true });
    console.log("  deleteAccount returned without throwing.\n");
  } catch (err) {
    console.error("  deleteAccount threw:", err);
    process.exit(1);
  }

  // ── Assert ────────────────────────────────────────────────────────────────
  console.log("Assertions:");

  // User is gone
  assert(
    "throwaway User is deleted",
    !(await db.user.findUnique({ where: { id: testUser.id } })),
  );

  // FamilyProfile is gone
  assert(
    "FamilyProfile is deleted",
    !(await db.familyProfile.findUnique({ where: { id: testProfile.id } })),
  );

  // Private tour is gone
  assert(
    "private GeneratedTour is deleted",
    !(await db.generatedTour.findUnique({ where: { id: privateTourId } })),
  );

  // Private spot is gone
  assert(
    "private CommunitySpot is deleted",
    !(await db.communitySpot.findUnique({ where: { id: privateSpot.id } })),
  );

  // PlaceRating is gone
  assert(
    "PlaceRating is deleted",
    !(await db.placeRating.findUnique({ where: { id: testRating.id } })),
  );

  // Trip is gone
  assert(
    "Trip is deleted",
    !(await db.trip.findUnique({ where: { id: testTrip.id } })),
  );

  // ItineraryItem is gone (explicitly deleted before trip)
  assert(
    "ItineraryItem is deleted",
    !(await db.itineraryItem.findUnique({ where: { id: testItinItem.id } })),
  );

  // ManualActivity is gone (cascaded from trip)
  assert(
    "ManualActivity is deleted (cascaded from trip)",
    !(await db.manualActivity.findUnique({ where: { id: testManualActivity.id } })),
  );

  // Public tour reassigned to demo profile
  const retainedTour = await db.generatedTour.findUnique({
    where: { id: publicTourId },
    include: { stops: true },
  });
  assert(
    "public GeneratedTour still exists",
    retainedTour !== null,
  );
  assert(
    "public GeneratedTour reassigned to DEMO_PROFILE_ID",
    retainedTour?.familyProfileId === DEMO_PROFILE_ID,
  );
  assert(
    "public tour prompt is cleared",
    retainedTour?.prompt === "",
  );
  assert(
    "public tour title uses publicTitle",
    retainedTour?.title === "Public Title Scrubbed",
  );
  assert(
    "public tour subtitle uses publicSubtitle",
    retainedTour?.subtitle === "Public Subtitle Kept",
  );

  const stop1 = retainedTour?.stops.find((s) => s.id === stopId1);
  const stop2 = retainedTour?.stops.find((s) => s.id === stopId2);
  assert("stop1 why is null", stop1?.why === null);
  assert("stop1 familyNote is null", stop1?.familyNote === null);
  assert("stop1 publicWhy retained", stop1?.publicWhy === "public why 1");
  assert("stop1 publicFamilyNote retained", stop1?.publicFamilyNote === "public family note 1");
  assert("stop2 why is null", stop2?.why === null);
  assert("stop2 familyNote is null", stop2?.familyNote === null);

  // Public spot reassigned to demo profile
  const retainedSpot = await db.communitySpot.findUnique({
    where: { id: publicSpot.id },
  });
  assert(
    "public CommunitySpot still exists",
    retainedSpot !== null,
  );
  assert(
    "public CommunitySpot reassigned to DEMO_PROFILE_ID",
    retainedSpot?.authorProfileId === DEMO_PROFILE_ID,
  );

  // ── Cleanup ───────────────────────────────────────────────────────────────
  console.log("\nCleaning up retained test data from demo profile...");
  await db.generatedTour.delete({ where: { id: publicTourId } });
  await db.communitySpot.delete({ where: { id: publicSpot.id } });
  console.log("  Demo profile is clean.");

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
  });
