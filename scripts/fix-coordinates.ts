/**
 * fix-coordinates.ts
 *
 * PART 1: Set accommodationLat/accommodationLng on Greene family trips.
 * PART 2: Fix 3 wrong ItineraryItem geocodes.
 *
 * Read-write data script — no app files touched, no deploy.
 * Run: npx tsx scripts/fix-coordinates.ts
 */

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.production" });

const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PROFILE_ID = "cmmmv15y7000104jvocfz5kt6";

// ── PART 1: Trip accommodation coordinates ───────────────────────────────────
// Key = substring to match against trip.destinationCity (case-insensitive includes)
const TRIP_COORDS: Array<{ match: string; lat: number; lng: number }> = [
  { match: "Tokyo",      lat: 35.6762,  lng: 139.6503  },
  { match: "Kyoto",      lat: 35.0116,  lng: 135.7681  },
  { match: "Seoul",      lat: 37.5665,  lng: 126.9780  },
  { match: "Chiang Mai", lat: 18.7883,  lng: 98.9853   },
  { match: "Chiang Rai", lat: 19.9105,  lng: 99.8406   },
  { match: "Ha Long",    lat: 20.9101,  lng: 107.1839  },
  { match: "Athens",     lat: 37.9838,  lng: 23.7275   },
  { match: "Colombo",    lat: 6.9271,   lng: 79.8612   },
  { match: "London",     lat: 51.5074,  lng: -0.1278   },
  { match: "Koh Lanta",  lat: 7.5660,   lng: 99.0379   },
  { match: "Kamakura",   lat: 35.3197,  lng: 139.5500  },
  { match: "Hakone",     lat: 35.2326,  lng: 139.1069  },
  { match: "Scotland",   lat: 56.4907,  lng: -4.2026   },
  { match: "Okinawa",   lat: 26.2124,  lng: 127.6809  },
  { match: "Cairo",     lat: 30.0444,  lng: 31.2357   },
  { match: "Dublin",    lat: 53.3498,  lng: -6.2603   },
  { match: "Ireland",   lat: 53.1424,  lng: -7.6921   },
  { match: "Bangkok",   lat: 13.7563,  lng: 100.5018  },
  { match: "Dubai",     lat: 25.2048,  lng: 55.2708   },
];

async function main() {
  // Load all trips for the profile
  const trips = await prisma.trip.findMany({
    where: { familyProfileId: PROFILE_ID },
    select: { id: true, title: true, destinationCity: true, accommodationLat: true, accommodationLng: true },
  });

  console.log("═".repeat(70));
  console.log("PART 1 — Setting trip accommodationLat / accommodationLng");
  console.log("═".repeat(70));

  for (const entry of TRIP_COORDS) {
    const trip = trips.find((t) =>
      (t.destinationCity ?? "").toLowerCase().includes(entry.match.toLowerCase())
    );
    if (!trip) {
      console.log(`  No trip found for "${entry.match}"`);
      continue;
    }
    await prisma.trip.update({
      where: { id: trip.id },
      data: { accommodationLat: entry.lat, accommodationLng: entry.lng },
    });
    console.log(`  Updated "${trip.destinationCity}" (${trip.id}): lat ${entry.lat} lng ${entry.lng}`);
  }

  // ── PART 2: Fix wrong ItineraryItem geocodes ─────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log("PART 2 — Fixing 3 wrong ItineraryItem geocodes");
  console.log("═".repeat(70));

  const fixes: Array<{ titleContains: string; destMatch: string; lat: number; lng: number }> = [
    { titleContains: "Daytrip",         destMatch: "Chiang Rai", lat: 19.9105, lng: 99.8406  },
    { titleContains: "Tune Protect",    destMatch: "Ha Long",    lat: 20.9101, lng: 107.1839 },
    { titleContains: "Vietnam Airlines",destMatch: "Tokyo",      lat: 35.6762, lng: 139.6503 },
  ];

  for (const fix of fixes) {
    const trip = trips.find((t) =>
      (t.destinationCity ?? "").toLowerCase().includes(fix.destMatch.toLowerCase())
    );
    if (!trip) {
      console.log(`  No trip found for "${fix.destMatch}" — skipping "${fix.titleContains}"`);
      continue;
    }
    const item = await prisma.itineraryItem.findFirst({
      where: {
        tripId: trip.id,
        title: { contains: fix.titleContains, mode: "insensitive" },
      },
      select: { id: true, title: true, latitude: true, longitude: true },
    });
    if (!item) {
      console.log(`  No item found containing "${fix.titleContains}" on trip "${trip.destinationCity}"`);
      continue;
    }
    console.log(`  "${item.title}" (${item.id})`);
    console.log(`    old: lat ${item.latitude ?? "null"} lng ${item.longitude ?? "null"}`);
    console.log(`    new: lat ${fix.lat} lng ${fix.lng}`);
    await prisma.itineraryItem.update({
      where: { id: item.id },
      data: { latitude: fix.lat, longitude: fix.lng },
    });
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log("SUMMARY");
  console.log("═".repeat(70));

  const allTrips = await prisma.trip.findMany({
    where: { familyProfileId: PROFILE_ID },
    select: { destinationCity: true, accommodationLat: true, accommodationLng: true },
  });
  const withCoords = allTrips.filter((t) => t.accommodationLat != null);
  const withoutCoords = allTrips.filter((t) => t.accommodationLat == null);

  console.log(`  Trips with accommodationLat set    : ${withCoords.length}`);
  console.log(`  Trips still null                   : ${withoutCoords.length}`);
  if (withoutCoords.length > 0) {
    for (const t of withoutCoords) {
      console.log(`    - "${t.destinationCity ?? "(no destination)"}"`);
    }
  }

  console.log("\n  Corrected ItineraryItems:");
  for (const fix of fixes) {
    const trip = allTrips.find((t) =>
      (t.destinationCity ?? "").toLowerCase().includes(fix.destMatch.toLowerCase())
    );
    if (!trip) continue;
    const tripFull = trips.find((t) =>
      (t.destinationCity ?? "").toLowerCase().includes(fix.destMatch.toLowerCase())
    );
    if (!tripFull) continue;
    const item = await prisma.itineraryItem.findFirst({
      where: {
        tripId: tripFull.id,
        title: { contains: fix.titleContains, mode: "insensitive" },
      },
      select: { id: true, title: true, latitude: true, longitude: true },
    });
    if (item) {
      console.log(`    "${item.title}": lat ${item.latitude} lng ${item.longitude}`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
