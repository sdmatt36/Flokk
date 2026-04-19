// Chat 27 Prompt 7 — Seed Trip.cities[] and Trip.country for all existing trips.
//
// Option B derivation:
//   1. Start with hardcoded seed cities per trip (from title + known destinations).
//   2. Append any city from saves explicitly linked to this trip via tripId.
//   3. Cross-contamination guard: only include a save-derived city if it does NOT
//      appear in any OTHER trip's hardcoded seed. Prevents misattributed saves
//      (e.g. a Seoul save tagged with city=Kyoto) from poisoning the cities array.
//
// Usage:
//   npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/seed-trip-cities-and-country.ts
//   npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/seed-trip-cities-and-country.ts --live

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const LIVE = process.argv.includes("--live");

const TRIP_SEEDS: Record<string, { cities: string[]; country: string }> = {
  "cmmyhbk8g000004jpof1i3g52": {
    cities: ["Kamakura", "Enoshima", "Zushi"],
    country: "Japan",
  },
  "cmmet611o0000yn8nz6ss7yg4": {
    cities: ["Okinawa", "Naha", "Motobu", "Uruma", "Onna"],
    country: "Japan",
  },
  "cmmx09fra000004if78drj98m": {
    cities: ["Colombo", "Kandy", "Galle", "Negombo", "Dehiwala", "Mount Lavinia", "Moratuwa"],
    country: "Sri Lanka",
  },
  "cmnhgoflq000004l4403jm4mx": {
    cities: ["London"],
    country: "United Kingdom",
  },
  "cmnhgp10p000104l4hlof4gjc": {
    cities: ["Edinburgh", "Glasgow", "Aberdeen", "Dundee", "Aberlour", "Inverness", "Stirling", "Perth", "Dunfermline", "Fife"],
    country: "United Kingdom",
  },
  "cmnhgpj7s000004l4io6ijbyj": {
    cities: ["Dublin", "Belfast", "Cork", "Galway", "Limerick", "Waterford", "Kilkenny", "Letterkenny", "Drogheda", "Dundalk", "Swords", "Blanchardstown"],
    country: "Ireland",
  },
  "cmmx6428k000004jlxgel7s86": {
    cities: ["Seoul", "Busan"],
    country: "South Korea",
  },
  "cmnqyz2gp000104jo2jju2vsd": {
    cities: ["Hakone"],
    country: "Japan",
  },
  "cmmyecm11000004jrdj3zwmi0": {
    cities: ["Kyoto", "Nara"],
    country: "Japan",
  },
  "cmmycshfj000004jpyadzdp8y": {
    cities: ["Tokyo"],
    country: "Japan",
  },
  "cmnqv13gr000404lfv4metkkj": {
    cities: ["Ha Long Bay", "Ninh Binh"],
    country: "Vietnam",
  },
  "cmnqut92m000104lffty6397h": {
    cities: ["Koh Lanta"],
    country: "Thailand",
  },
  "cmo0t52de000004jow1m57i3l": {
    cities: ["Chiang Mai"],
    country: "Thailand",
  },
  "cmmy95w8b000004l5l8rd4e01": {
    cities: ["Chiang Rai"],
    country: "Thailand",
  },
  "cmo0tcd05000004l1adf7tt8c": {
    cities: ["Bangkok"],
    country: "Thailand",
  },
  "cmnquuqzw000204lfn4dy2gsj": {
    cities: ["Dubai"],
    country: "United Arab Emirates",
  },
  "cmnquwivf000004i8e0g8z3ro": {
    cities: ["Cairo", "Luxor"],
    country: "Egypt",
  },
  // "cmo2xj2du000004l8k08yyn0i" (My Places) — intentionally skipped
};

async function main() {
  console.log(`[seed-trips] Mode: ${LIVE ? "LIVE" : "DRY RUN"}`);
  console.log(`[seed-trips] Started: ${new Date().toISOString()}\n`);

  // Build cross-contamination guard: city (lowercase) → the trip that "owns" it in the seed
  const globalSeedCityOwner = new Map<string, string>(); // lowercase city → tripId
  for (const [tripId, seed] of Object.entries(TRIP_SEEDS)) {
    for (const city of seed.cities) {
      globalSeedCityOwner.set(city.trim().toLowerCase(), tripId);
    }
  }

  let updated = 0;
  let skipped = 0;

  for (const [tripId, seed] of Object.entries(TRIP_SEEDS)) {
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      select: { id: true, title: true, cities: true, country: true },
    });
    if (!trip) {
      console.log(`  [SKIP] ${tripId} — not found in DB`);
      skipped += 1;
      continue;
    }

    // Option B: collect cities from saves linked to this trip
    const savesForTrip = await db.savedItem.findMany({
      where: { tripId, destinationCity: { not: null } },
      select: { destinationCity: true },
    });

    const rawSavedCities = Array.from(
      new Set(savesForTrip.map((s) => s.destinationCity!.trim()).filter(Boolean))
    );

    // Cross-contamination filter: skip cities that belong to another trip's seed
    const filteredSavedCities = rawSavedCities.filter((city) => {
      const owner = globalSeedCityOwner.get(city.trim().toLowerCase());
      return !owner || owner === tripId; // include if unowned OR owned by this trip
    });

    const contaminated = rawSavedCities.filter((city) => {
      const owner = globalSeedCityOwner.get(city.trim().toLowerCase());
      return owner && owner !== tripId;
    });

    const finalCities = Array.from(new Set([...seed.cities, ...filteredSavedCities]));

    console.log(`  ${trip.title} (${tripId})`);
    console.log(`    Seed cities:     ${seed.cities.join(", ")}`);
    if (filteredSavedCities.length > 0) {
      const extras = filteredSavedCities.filter((c) => !seed.cities.map(s => s.toLowerCase()).includes(c.toLowerCase()));
      if (extras.length > 0) console.log(`    + from saves:    ${extras.join(", ")}`);
    }
    if (contaminated.length > 0) {
      console.log(`    ! contaminated (blocked): ${contaminated.map((c) => `${c} → owned by ${globalSeedCityOwner.get(c.toLowerCase())}`).join(", ")}`);
    }
    console.log(`    Final cities:    ${finalCities.join(", ")}`);
    console.log(`    Country:         ${seed.country}`);
    console.log(`    Current in DB:   cities=[${trip.cities.join(", ")}] country=${trip.country ?? "null"}`);

    if (LIVE) {
      await db.trip.update({
        where: { id: tripId },
        data: { cities: finalCities, country: seed.country },
      });
      updated += 1;
    }
    console.log();
  }

  console.log(`[seed-trips] ${LIVE ? "Updated" : "Would update"}: ${Object.keys(TRIP_SEEDS).length - skipped}`);
  console.log(`[seed-trips] Skipped (not in DB): ${skipped}`);
  console.log(`[seed-trips] Finished: ${new Date().toISOString()}`);

  await db.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error("[seed-trips] FATAL:", e);
  await db.$disconnect();
  await pool.end();
  process.exit(1);
});
