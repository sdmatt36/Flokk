// One-time backfill: attach existing trip-less, city-resolved saves to a CONFIDENT
// upcoming-trip city match. Reuses the exact same matcher + guard as the live
// enrichment path (src/lib/find-matching-trip.ts) so backfill and write-time never
// diverge. NEVER attaches to a past/completed trip.
//
// DRY-RUN BY DEFAULT. Pass --execute to actually write tripId/status.
//   npm run backfill:trip-autoattach -- <familyProfileId>             (dry-run)
//   npm run backfill:trip-autoattach -- <familyProfileId> --execute   (writes)
//
// Idempotent: only scans tripId IS NULL, deletedAt IS NULL, destinationCity NOT NULL.

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const profileId = args.find((a) => !a.startsWith("--"));

// NOTE: @/lib/db reads DATABASE_URL at module-init time; ESM hoists static imports
// above dotenv.config(), so db (and modules that import it) MUST be imported
// dynamically inside main() — after env is loaded. Mirrors the other backfill scripts.
async function main() {
  if (!profileId) {
    console.error(
      "Usage: tsx --tsconfig tsconfig.scripts.json scripts/backfill-trip-autoattach.ts <familyProfileId> [--execute]",
    );
    process.exit(1);
  }

  const { db } = await import("@/lib/db");
  const { findMatchingUpcomingTrip, passesAttachGuard } = await import(
    "@/lib/find-matching-trip"
  );

  console.log(
    EXECUTE
      ? "MODE: --execute (writing tripId/status)\n"
      : "MODE: dry-run (no writes — pass --execute to apply)\n",
  );
  console.log(`Profile: ${profileId}\n`);

  const trips = await db.trip.findMany({
    where: { familyProfileId: profileId, isPlacesLibrary: false },
    select: {
      id: true,
      title: true,
      destinationCity: true,
      cities: true,
      startDate: true,
      endDate: true,
    },
  });

  const saves = await db.savedItem.findMany({
    where: {
      familyProfileId: profileId,
      tripId: null,
      deletedAt: null,
      destinationCity: { not: null },
    },
    select: {
      id: true,
      tripId: true,
      rawTitle: true,
      destinationCity: true,
      needsPlaceConfirmation: true,
      googlePlaceId: true,
      lat: true,
      lng: true,
      sourceMethod: true,
    },
  });

  const wouldAttach: {
    saveId: string;
    title: string | null;
    city: string | null;
    tripId: string;
    tripTitle: string;
  }[] = [];
  let guardSkipped = 0;
  let noMatch = 0;

  for (const s of saves) {
    if (!passesAttachGuard(s)) {
      guardSkipped++;
      continue;
    }
    const match = findMatchingUpcomingTrip(s.destinationCity, trips);
    if (!match) {
      noMatch++;
      continue;
    }
    wouldAttach.push({
      saveId: s.id,
      title: s.rawTitle,
      city: s.destinationCity,
      tripId: match.id,
      tripTitle: match.title,
    });
  }

  console.log(`Trip-less, city-resolved candidates : ${saves.length}`);
  console.log(`Skipped by guard                    : ${guardSkipped}`);
  console.log(`No upcoming-trip city match         : ${noMatch}`);
  console.log(`WOULD attach                        : ${wouldAttach.length}\n`);
  for (const w of wouldAttach) {
    console.log(`  - "${w.title}" [${w.city}]  ->  ${w.tripTitle} (${w.tripId})`);
  }

  if (EXECUTE) {
    let written = 0;
    for (const w of wouldAttach) {
      await db.savedItem.update({
        where: { id: w.saveId },
        data: { tripId: w.tripId, status: "TRIP_ASSIGNED" },
      });
      written++;
    }
    console.log(`\nAttached ${written} save(s).`);
  } else {
    console.log(`\nDry-run only. Re-run with --execute to write.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
