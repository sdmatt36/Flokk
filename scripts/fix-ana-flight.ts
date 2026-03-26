/**
 * fix-ana-flight.ts
 *
 * One-time fix: the ANA NH867 ItineraryItem (confirmationCode DOAL4Z) was
 * created when Claude failed to extract airports/times on a re-forward.
 * The correct data exists in a vault TripDocument from the first forward.
 *
 * This script:
 *  1. Finds the FLIGHT ItineraryItem with confirmationCode DOAL4Z
 *  2. Finds the vault TripDocument for the same trip+confirmationCode that
 *     has non-null airport data (the Flight model record has empty strings)
 *  3. Copies fromAirport, toAirport, fromCity, toCity, departureTime,
 *     arrivalTime and fixes the title to "[from] → [to]"
 *
 * Run: npx ts-node --project tsconfig.json scripts/fix-ana-flight.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const CONF_CODE = "DOAL4Z";

async function main() {
  // Step 1: find the ItineraryItem
  const items = await db.itineraryItem.findMany({
    where: { confirmationCode: CONF_CODE, type: "FLIGHT" },
    select: { id: true, tripId: true, title: true, fromAirport: true, toAirport: true, departureTime: true, arrivalTime: true },
  });

  if (items.length === 0) {
    console.log(`[fix-ana] no FLIGHT ItineraryItem found for confirmationCode ${CONF_CODE}`);
    return;
  }

  for (const item of items) {
    console.log(`[fix-ana] found ItineraryItem ${item.id} title="${item.title}" fromAirport=${item.fromAirport} toAirport=${item.toAirport} departureTime=${item.departureTime} arrivalTime=${item.arrivalTime}`);

    // Step 2: check the Flight model record first (might have data)
    const flightRecord = await db.flight.findFirst({
      where: { confirmationCode: CONF_CODE, tripId: item.tripId },
      select: { fromAirport: true, toAirport: true, fromCity: true, toCity: true, departureTime: true, arrivalTime: true },
    });

    // Flight model uses empty strings when Claude failed — treat those as absent
    const fromFlight = flightRecord?.fromAirport?.trim() || null;
    const toFlight = flightRecord?.toAirport?.trim() || null;
    const depTimeFlight = flightRecord?.departureTime?.trim() || null;
    const arrTimeFlight = flightRecord?.arrivalTime?.trim() || null;
    const fromCityFlight = flightRecord?.fromCity?.trim() || null;
    const toCityFlight = flightRecord?.toCity?.trim() || null;

    console.log(`[fix-ana] Flight model — fromAirport: ${fromFlight} toAirport: ${toFlight} departureTime: ${depTimeFlight} arrivalTime: ${arrTimeFlight}`);

    // Step 3: if Flight model missing data, check vault TripDocuments
    let fromAirport = fromFlight ?? item.fromAirport;
    let toAirport = toFlight ?? item.toAirport;
    let fromCity = fromCityFlight ?? null;
    let toCity = toCityFlight ?? null;
    let departureTime = depTimeFlight ?? item.departureTime;
    let arrivalTime = arrTimeFlight ?? item.arrivalTime;

    const anyMissing = !fromAirport || !toAirport || !departureTime;
    if (anyMissing) {
      const vaultDocs = await db.tripDocument.findMany({
        where: { tripId: item.tripId, type: "booking" },
        select: { content: true },
      });

      for (const doc of vaultDocs) {
        let b: Record<string, unknown> = {};
        try { b = JSON.parse(doc.content ?? "{}"); } catch { continue; }
        if ((b.confirmationCode as string | null) !== CONF_CODE) continue;

        const docFrom = (b.fromAirport as string | null)?.trim() || null;
        const docTo = (b.toAirport as string | null)?.trim() || null;
        const docDep = (b.departureTime as string | null)?.trim() || null;
        const docArr = (b.arrivalTime as string | null)?.trim() || null;
        const docFromCity = (b.fromCity as string | null)?.trim() || null;
        const docToCity = (b.toCity as string | null)?.trim() || null;

        if (docFrom) fromAirport = fromAirport ?? docFrom;
        if (docTo) toAirport = toAirport ?? docTo;
        if (docDep) departureTime = departureTime ?? docDep;
        if (docArr) arrivalTime = arrivalTime ?? docArr;
        if (docFromCity) fromCity = fromCity ?? docFromCity;
        if (docToCity) toCity = toCity ?? docToCity;

        console.log(`[fix-ana] vault doc — fromAirport: ${docFrom} toAirport: ${docTo} departureTime: ${docDep} arrivalTime: ${docArr}`);
      }
    }

    const newTitle =
      fromAirport && toAirport
        ? `${fromAirport} → ${toAirport}`
        : fromCity && toCity
        ? `${fromCity} → ${toCity}`
        : item.title;

    await db.itineraryItem.update({
      where: { id: item.id },
      data: {
        fromAirport: fromAirport ?? undefined,
        toAirport: toAirport ?? undefined,
        fromCity: fromCity ?? undefined,
        toCity: toCity ?? undefined,
        departureTime: departureTime ?? undefined,
        arrivalTime: arrivalTime ?? undefined,
        title: newTitle,
      },
    });

    console.log(
      `[fix-ana] updated ItineraryItem ${item.id} — title: "${newTitle}" fromAirport: ${fromAirport} toAirport: ${toAirport} departureTime: ${departureTime} arrivalTime: ${arrivalTime}`
    );
  }

  console.log("[fix-ana] done");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
