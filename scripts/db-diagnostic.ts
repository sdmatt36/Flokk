/**
 * db-diagnostic.ts
 *
 * Read-only diagnostic of all Greene family trips and items.
 * Uses .env.production for DATABASE_URL (matches deployed Vercel environment).
 *
 * Run: npx tsx scripts/db-diagnostic.ts
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

function pad(s: string | null | undefined, len: number): string {
  const str = s ?? "-";
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

async function main() {
  // ── Profile members ──────────────────────────────────────────────────────
  const members = await prisma.profileMember.findMany({
    where: { familyProfileId: PROFILE_ID },
    select: { id: true, clerkUserId: true, createdAt: true, role: true },
  });

  // ── Trips ────────────────────────────────────────────────────────────────
  const trips = await prisma.trip.findMany({
    where: { familyProfileId: PROFILE_ID },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      title: true,
      destinationCity: true,
      destinationCountry: true,
      startDate: true,
      endDate: true,
      status: true,
      accommodationLat: true,
      accommodationLng: true,
      itineraryItems: {
        select: {
          id: true,
          title: true,
          type: true,
          tripId: true,
          confirmationCode: true,
          scheduledDate: true,
          latitude: true,
          longitude: true,
        },
        orderBy: { scheduledDate: "asc" },
      },
      manualActivities: {
        select: {
          id: true,
          title: true,
          type: true,
          date: true,
          lat: true,
          lng: true,
        },
        orderBy: { date: "asc" },
      },
    },
  });

  // ── Unassigned ItineraryItems ────────────────────────────────────────────
  const unassigned = await prisma.itineraryItem.findMany({
    where: { familyProfileId: PROFILE_ID, tripId: null },
    select: {
      id: true,
      title: true,
      type: true,
      confirmationCode: true,
      scheduledDate: true,
      latitude: true,
      longitude: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // ── Totals ───────────────────────────────────────────────────────────────
  const totalItems      = trips.reduce((n, t) => n + t.itineraryItems.length, 0);
  const totalActivities = trips.reduce((n, t) => n + t.manualActivities.length, 0);

  console.log("═".repeat(80));
  console.log("  FLOKK DB DIAGNOSTIC — Greene Family Profile");
  console.log("═".repeat(80));
  console.log(`  Profile ID         : ${PROFILE_ID}`);
  console.log(`  Total trips        : ${trips.length}`);
  console.log(`  Total ItineraryItems: ${totalItems}`);
  console.log(`  Total ManualActivities: ${totalActivities}`);
  console.log(`  Unassigned items   : ${unassigned.length}`);
  console.log(`  ProfileMember rows : ${members.length}`);
  console.log("─".repeat(80));
  console.log("  PROFILE MEMBERS");
  for (const m of members) {
    console.log(`    id:${m.id}  clerkUserId:${m.clerkUserId}  role:${m.role}  createdAt:${m.createdAt.toISOString()}`);
  }

  // ── Per-trip detail ──────────────────────────────────────────────────────
  for (const trip of trips) {
    console.log("\n" + "═".repeat(80));
    console.log(`  TRIP: ${trip.title ?? trip.destinationCity}`);
    console.log(`    id          : ${trip.id}`);
    console.log(`    destination : ${trip.destinationCity ?? "-"}, ${trip.destinationCountry ?? "-"}`);
    console.log(`    dates       : ${trip.startDate?.toISOString().split("T")[0] ?? "-"} → ${trip.endDate?.toISOString().split("T")[0] ?? "-"}`);
    console.log(`    status      : ${trip.status ?? "-"}`);
    console.log(`    lat/lng     : ${trip.accommodationLat ?? "null"} / ${trip.accommodationLng ?? "null"}`);
    console.log(`    items       : ${trip.itineraryItems.length} ItineraryItems, ${trip.manualActivities.length} ManualActivities`);

    if (trip.itineraryItems.length > 0) {
      console.log("    ── ItineraryItems ──────────────────────────────────────────────────");
      for (const item of trip.itineraryItems) {
        const lat = item.latitude  != null ? item.latitude.toFixed(4)  : "null";
        const lng = item.longitude != null ? item.longitude.toFixed(4) : "null";
        console.log(
          `      [${pad(item.type, 10)}] ${pad(item.title, 45)} date:${pad(item.scheduledDate, 10)} lat:${pad(lat, 8)} lng:${pad(lng, 9)} conf:${item.confirmationCode ?? "-"}`
        );
        console.log(`                 id:${item.id}`);
      }
    }

    if (trip.manualActivities.length > 0) {
      console.log("    ── ManualActivities ────────────────────────────────────────────────");
      for (const act of trip.manualActivities) {
        const lat = act.lat != null ? act.lat.toFixed(4) : "null";
        const lng = act.lng != null ? act.lng.toFixed(4) : "null";
        console.log(
          `      [${pad(act.type, 10)}] ${pad(act.title, 45)} date:${pad(act.date, 10)} lat:${pad(lat, 8)} lng:${pad(lng, 9)}`
        );
        console.log(`                 id:${act.id}`);
      }
    }
  }

  // ── Unassigned ───────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(80));
  console.log(`  UNASSIGNED ItineraryItems (tripId = null): ${unassigned.length}`);
  if (unassigned.length > 0) {
    for (const item of unassigned) {
      const lat = item.latitude  != null ? item.latitude.toFixed(4)  : "null";
      const lng = item.longitude != null ? item.longitude.toFixed(4) : "null";
      console.log(
        `    [${pad(item.type, 10)}] ${pad(item.title, 45)} date:${pad(item.scheduledDate, 10)} lat:${pad(lat, 8)} lng:${pad(lng, 9)} conf:${item.confirmationCode ?? "-"}`
      );
      console.log(`               id:${item.id}`);
    }
  }

  console.log("\n" + "═".repeat(80));
  console.log("  END OF DIAGNOSTIC");
  console.log("═".repeat(80));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
