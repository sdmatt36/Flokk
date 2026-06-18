import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ adapter } as any);

const TRIP_ID = "cmo65s395000004l5zbsnscg6";
const FAMILY_PROFILE_ID = "cmo65pvt5000104jsh6h3h0db";
const ITEM_IDS = [
  "cmqj4k6zp000004l8p3l0gmet",
  "cmqj4klbc000204l8dnhnp34n",
];
const SCHEDULED_DATE = "2026-07-18";

async function main() {
  const trip = await db.trip.findUnique({
    where: { id: TRIP_ID },
    select: { id: true, title: true, startDate: true, endDate: true, familyProfileId: true },
  });
  if (!trip) throw new Error(`Trip ${TRIP_ID} not found`);
  if (trip.familyProfileId !== FAMILY_PROFILE_ID) throw new Error(`Profile mismatch: ${trip.familyProfileId}`);
  console.log(`Trip: "${trip.title}" ${trip.startDate?.toISOString()} – ${trip.endDate?.toISOString()}`);

  // dayIndex convention from getDayIndex: +12h shift then local date arithmetic
  const rawStart = new Date(trip.startDate!);
  const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
  const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
  const [sy, sm, sd] = SCHEDULED_DATE.split("-").map(Number);
  const schedLocal = new Date(sy, sm - 1, sd);
  const dayIndex = Math.round((schedLocal.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`dayIndex for ${SCHEDULED_DATE} relative to trip start: ${dayIndex}`);

  const before = await db.itineraryItem.findMany({
    where: { id: { in: ITEM_IDS } },
    select: { id: true, title: true, type: true, tripId: true, dayIndex: true, scheduledDate: true, familyProfileId: true },
  });
  console.log("Before:", JSON.stringify(before, null, 2));

  // Confirm no other profiles touched
  const wrongProfile = before.filter(i => i.familyProfileId !== FAMILY_PROFILE_ID);
  if (wrongProfile.length > 0) throw new Error(`Items belong to wrong profile: ${wrongProfile.map(i => i.id).join(", ")}`);

  for (const item of before) {
    if (item.tripId === TRIP_ID) {
      console.log(`SKIP ${item.id}: already on correct trip`);
      continue;
    }
    if (item.tripId !== null) {
      throw new Error(`${item.id} is already attached to a DIFFERENT trip (${item.tripId}) — aborting`);
    }
    const updated = await db.itineraryItem.update({
      where: { id: item.id },
      data: { tripId: TRIP_ID, dayIndex },
      select: { id: true, title: true, tripId: true, dayIndex: true },
    });
    console.log(`Updated: ${JSON.stringify(updated)}`);
  }

  const after = await db.itineraryItem.findMany({
    where: { id: { in: ITEM_IDS } },
    select: { id: true, title: true, tripId: true, dayIndex: true, scheduledDate: true },
  });
  console.log("After:", JSON.stringify(after, null, 2));

  // Confirm no duplicates: count items with this tripId + type RESTAURANT on day 13
  const onTrip = await db.itineraryItem.findMany({
    where: { tripId: TRIP_ID, type: "RESTAURANT" },
    select: { id: true, title: true, dayIndex: true },
    orderBy: { dayIndex: "asc" },
  });
  console.log(`All RESTAURANT items on trip ${TRIP_ID}:`, JSON.stringify(onTrip, null, 2));

  // Confirm no other profiles touched: only these two items should have changed
  console.log("Done. Only ITEM_IDS rows were written; no other profile data touched.");

  await db.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
