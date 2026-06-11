import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ADMIN_USER_IDS = [(process.env.ADMIN_CLERK_USER_ID ?? "").trim()];

async function isAdmin(userId: string): Promise<boolean> {
  if (ADMIN_USER_IDS.filter(Boolean).includes(userId.trim())) return true;
  const user = await db.user.findFirst({ where: { clerkId: userId } });
  return user?.email?.endsWith("@flokktravel.com") ?? false;
}

// Parse "A → B" from the notes route string — returns null if endpoints are not distinct.
function parseRouteDestination(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/^([^→]+?)\s*→\s*([^·\n.]+?)(?:\s*[·.\n]|$)/);
  if (!match) return null;
  const from = match[1].trim();
  const to = match[2].trim();
  return to && to !== from ? to : null;
}

// Parse "arrives? H:MM" from notes, applying 12→24h correction when departure is afternoon.
function parseArrivalTime(notes: string | null, departureTime: string | null): string | null {
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

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Find transport rows where fromCity = toCity (column-to-column comparison requires raw query).
  type Row = { id: string; fromCity: string; toCity: string; notes: string | null; departureTime: string | null; arrivalTime: string | null };
  const candidates = await db.$queryRaw<Row[]>`
    SELECT id, "fromCity", "toCity", notes, "departureTime", "arrivalTime"
    FROM "ItineraryItem"
    WHERE type IN ('TRAIN', 'BUS', 'FERRY', 'CAR_RENTAL')
      AND "fromCity" IS NOT NULL
      AND "toCity" IS NOT NULL
      AND "fromCity" = "toCity"
      AND "cancelledAt" IS NULL
  `;

  const results: Array<{ id: string; fromCity: string; oldToCity: string; newToCity: string | null; oldArrivalTime: string | null; newArrivalTime: string | null; action: string }> = [];

  for (const row of candidates) {
    const newToCity = parseRouteDestination(row.notes);
    const newArrivalTime = parseArrivalTime(row.notes, row.departureTime);

    if (!newToCity) {
      results.push({ id: row.id, fromCity: row.fromCity, oldToCity: row.toCity, newToCity: null, oldArrivalTime: row.arrivalTime, newArrivalTime: null, action: "skipped — no distinct destination in notes" });
      continue;
    }

    const updateData: Record<string, string | null> = { toCity: newToCity };
    if (newArrivalTime && newArrivalTime !== row.arrivalTime) updateData.arrivalTime = newArrivalTime;

    await db.itineraryItem.update({ where: { id: row.id }, data: updateData });

    results.push({
      id: row.id,
      fromCity: row.fromCity,
      oldToCity: row.toCity,
      newToCity,
      oldArrivalTime: row.arrivalTime,
      newArrivalTime: updateData.arrivalTime !== undefined ? (updateData.arrivalTime ?? null) : row.arrivalTime,
      action: `updated toCity → "${newToCity}"${updateData.arrivalTime !== undefined ? ` + arrivalTime → "${updateData.arrivalTime}"` : ""}`,
    });
  }

  return NextResponse.json({ fixed: results.filter((r) => r.action.startsWith("updated")).length, skipped: results.filter((r) => r.action.startsWith("skipped")).length, results });
}
