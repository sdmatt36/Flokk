// One-off: fix transport ItineraryItems where fromCity = toCity but notes route
// shows a distinct destination. Derives toCity from "A → B" in notes.
// Also corrects arrivalTime stored in 12h format when departure implies PM.
// Usage: node scripts/fix-transport-tocity.mjs

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function parseRouteDestination(notes) {
  if (!notes) return null;
  const match = notes.match(/^([^→]+?)\s*→\s*([^·\n.]+?)(?:\s*[·.\n]|$)/);
  if (!match) return null;
  const from = match[1].trim();
  const to = match[2].trim();
  return to && to !== from ? to : null;
}

function parseArrivalTime(notes, departureTime) {
  if (!notes) return null;
  const match = notes.match(/arrives?\s+(\d{1,2}):(\d{2})/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = match[2];
  if (h < 12 && departureTime) {
    const depHour = parseInt((departureTime.split(":")[0] ?? "0"), 10);
    if (depHour >= 12) h += 12;
  }
  return `${h.toString().padStart(2, "0")}:${m}`;
}

async function main() {
  const candidates = await prisma.$queryRaw`
    SELECT id, "fromCity", "toCity", notes, "departureTime", "arrivalTime"
    FROM "ItineraryItem"
    WHERE type IN ('TRAIN', 'BUS', 'FERRY', 'CAR_RENTAL')
      AND "fromCity" IS NOT NULL
      AND "toCity" IS NOT NULL
      AND "fromCity" = "toCity"
      AND "cancelledAt" IS NULL
  `;

  console.log(`Found ${candidates.length} candidate(s) where fromCity = toCity\n`);

  for (const row of candidates) {
    const newToCity = parseRouteDestination(row.notes);
    const newArrivalTime = parseArrivalTime(row.notes, row.departureTime);

    if (!newToCity) {
      console.log(`${row.id}  fromCity="${row.fromCity}"  notes="${row.notes ?? "(null)"}"  -> SKIP (no distinct destination in notes)`);
      continue;
    }

    const updateData = { toCity: newToCity };
    const arrivalNote = "";
    if (newArrivalTime && newArrivalTime !== row.arrivalTime) {
      updateData.arrivalTime = newArrivalTime;
    }

    await prisma.itineraryItem.update({ where: { id: row.id }, data: updateData });

    const arrivalMsg = updateData.arrivalTime ? ` + arrivalTime: "${row.arrivalTime ?? "null"}" → "${updateData.arrivalTime}"` : "";
    console.log(`${row.id}  toCity: "${row.toCity}" → "${newToCity}"${arrivalMsg}`);
    console.log(`  notes: "${row.notes ?? "(null)"}"`);
  }

  console.log("\nDone.");
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
