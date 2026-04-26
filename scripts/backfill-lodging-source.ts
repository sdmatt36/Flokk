/**
 * backfill-lodging-source.ts
 *
 * READ + WRITE — sets bookingSource and managementUrl on existing LODGING ItineraryItems.
 *
 * Strategy:
 * 1. Find all LODGING ItineraryItems with null bookingSource.
 * 2. For each, find the related TripDocument by (tripId + confirmationCode).
 * 3. Extract contactEmail from TripDocument.content JSON.
 * 4. Run detectBookingSource() with contactEmail + vendorName hint from title.
 * 5. UPDATE ItineraryItem with bookingSource + managementUrl.
 *
 * Idempotent: skips items already having bookingSource set.
 *
 * Run: npx tsx scripts/backfill-lodging-source.ts
 */

import { db } from "../src/lib/db";
import { detectBookingSource } from "../src/lib/lodging/detect-source";

async function main() {
  console.log("Backfilling bookingSource on LODGING ItineraryItems...\n");

  const items = await db.itineraryItem.findMany({
    where: {
      type: "LODGING",
      bookingSource: null,
    },
    select: {
      id: true,
      tripId: true,
      title: true,
      confirmationCode: true,
    },
  });

  console.log(`Found ${items.length} LODGING items with null bookingSource.\n`);

  const tally: Record<string, number> = {};
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item.tripId) { skipped++; continue; }

    // Find matching TripDocument by tripId + confirmationCode (if available)
    let contactEmail: string | null = null;
    let vendorName: string | null = null;

    if (item.confirmationCode) {
      const docs = await db.tripDocument.findMany({
        where: { tripId: item.tripId },
        select: { content: true },
      });

      for (const doc of docs) {
        if (!doc.content) continue;
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(doc.content) as Record<string, unknown>; } catch { continue; }
        if (
          typeof parsed.confirmationCode === "string" &&
          parsed.confirmationCode === item.confirmationCode &&
          (parsed.type as string | undefined)?.toLowerCase() === "hotel"
        ) {
          contactEmail = (parsed.contactEmail as string | null) ?? null;
          vendorName = (parsed.vendorName as string | null) ?? null;
          break;
        }
      }
    }

    // Fallback: derive vendor from title ("Check-in: Heeton..." → "Heeton...")
    if (!vendorName) {
      vendorName = item.title.replace(/^check-in:\s*/i, "").replace(/^check-out:\s*/i, "").trim();
    }

    const { source, managementUrl } = detectBookingSource({ contactEmail, vendorName });

    await db.itineraryItem.update({
      where: { id: item.id },
      data: { bookingSource: source, managementUrl },
    });

    tally[source] = (tally[source] ?? 0) + 1;
    updated++;

    const shortTitle = item.title.length > 60 ? item.title.slice(0, 60) + "…" : item.title;
    console.log(`  ✓ ${shortTitle} → ${source}${managementUrl ? ` [${managementUrl}]` : ""}`);
  }

  console.log(`\nDone. Updated ${updated}, skipped ${skipped}.`);
  console.log("Source breakdown:");
  for (const [src, count] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${src}: ${count}`);
  }

  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
