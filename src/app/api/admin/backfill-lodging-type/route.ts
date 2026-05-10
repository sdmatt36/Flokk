import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inferLodgingType } from "@/lib/infer-lodging-type";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ItineraryItem — all LODGING rows missing lodgingType
  const lodgingItems = await db.itineraryItem.findMany({
    where: { type: "LODGING", lodgingType: null },
    select: { id: true, title: true, venueUrl: true, managementUrl: true, bookingSource: true },
  });

  let itemsUpdated = 0;
  for (const item of lodgingItems) {
    const inferred = inferLodgingType({
      url: item.venueUrl ?? item.managementUrl ?? null,
      bookingSource: item.bookingSource ?? null,
      name: item.title ?? null,
    });
    if (inferred) {
      await db.itineraryItem.update({ where: { id: item.id }, data: { lodgingType: inferred } });
      itemsUpdated++;
    }
  }

  // SavedItem — lodging-tagged saves missing lodgingType
  const lodgingSaves = await db.savedItem.findMany({
    where: { lodgingType: null, categoryTags: { has: "lodging" }, deletedAt: null },
    select: { id: true, rawTitle: true, websiteUrl: true, sourceUrl: true },
  });

  let savesUpdated = 0;
  for (const save of lodgingSaves) {
    const inferred = inferLodgingType({
      url: save.websiteUrl ?? save.sourceUrl ?? null,
      name: save.rawTitle ?? null,
    });
    if (inferred) {
      await db.savedItem.update({ where: { id: save.id }, data: { lodgingType: inferred } });
      savesUpdated++;
    }
  }

  return NextResponse.json({
    itineraryItemsScanned: lodgingItems.length,
    itineraryItemsUpdated: itemsUpdated,
    savedItemsScanned: lodgingSaves.length,
    savedItemsUpdated: savesUpdated,
  });
}
