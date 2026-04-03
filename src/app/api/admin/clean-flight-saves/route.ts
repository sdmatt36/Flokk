import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Flight booking domains — SavedItems with these source URLs but no flight categoryTag
// are dirty legacy data from before the server-side filter was added.
const FLIGHT_DOMAINS = [
  "google.com/travel/flights",
  "expedia.com/flights",
  "kayak.com/flights",
  "skyscanner",
  "momondo",
  "flights.google.com",
  "koreanair.com",
  "flyasiana.com",
  "united.com/en/us/flights",
  "delta.com",
  "aa.com",
  "jal.com",
  "ana.co.jp",
  "singaporeair.com",
  "cathaypacific.com",
  "qatarairways.com",
  "emirates.com",
  "etihad.com",
  "lufthansa.com",
  "airfrance.com",
  "britishairways.com",
  "ba.com",
  "southwest.com",
  "ryanair.com",
  "easyjet.com",
];

const FLIGHT_TAG = "flight";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find SavedItems that:
  // 1. Have no flight categoryTag already
  // 2. Have a sourceUrl matching a flight booking domain
  // 3. Have no lat/lng (genuine flight saves, not places that happen to have flight in the URL)
  const candidates = await db.savedItem.findMany({
    where: {
      AND: [
        { lat: null },
        { lng: null },
        {
          NOT: {
            categoryTags: {
              hasSome: ["flight", "airfare", "airline", "airflight", "flights", "Flight", "Airline", "Airfare"],
            },
          },
        },
        {
          OR: FLIGHT_DOMAINS.map((domain) => ({
            sourceUrl: { contains: domain, mode: "insensitive" as const },
          })),
        },
      ],
    },
    select: { id: true, sourceUrl: true, rawTitle: true, categoryTags: true },
  });

  if (candidates.length === 0) {
    return NextResponse.json({ tagged: 0, message: "No dirty flight saves found." });
  }

  let tagged = 0;
  for (const item of candidates) {
    await db.savedItem.update({
      where: { id: item.id },
      data: { categoryTags: { set: [...item.categoryTags, FLIGHT_TAG] } },
    });
    tagged++;
  }

  return NextResponse.json({
    tagged,
    message: `Tagged ${tagged} flight save${tagged === 1 ? "" : "s"} with '${FLIGHT_TAG}'.`,
    ids: candidates.map((c) => c.id),
  });
}
