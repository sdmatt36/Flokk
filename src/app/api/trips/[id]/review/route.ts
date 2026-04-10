import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const trip = await db.trip.findFirst({
    where: {
      id: tripId,
      familyProfile: { user: { clerkId: userId } },
    },
    include: {
      itineraryItems: { orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }] },
      manualActivities: { orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }] },
      familyProfile: { include: { members: true } },
    },
  });

  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Build traveller summary
  const members = trip.familyProfile.members;
  const childCount = members.filter(m => m.role === "CHILD").length;
  const roles = members.length > 0
    ? members.map(m => m.role.charAt(0) + m.role.slice(1).toLowerCase()).join(", ")
    : "unknown";

  const fmt = (d: Date | null | undefined) =>
    d ? d.toISOString().split("T")[0] : "unknown";

  // Normalise both item types into a common shape for grouping
  type ReviewItem = { title: string; type: string; time: string; sortOrder: number; dayIndex: number };

  const allItems: ReviewItem[] = [
    ...trip.itineraryItems.map(it => ({
      title: it.title,
      type: it.type,
      time: it.departureTime ?? it.arrivalTime ?? "unscheduled",
      sortOrder: it.sortOrder,
      dayIndex: it.dayIndex ?? 0,
    })),
    ...trip.manualActivities.map(ma => ({
      title: ma.title,
      type: ma.type ?? "ACTIVITY",
      time: ma.time ?? "unscheduled",
      sortOrder: ma.sortOrder,
      dayIndex: ma.dayIndex ?? 0,
    })),
  ];

  // Group by dayIndex (0-based)
  const byDay = new Map<number, ReviewItem[]>();
  for (const item of allItems) {
    if (!byDay.has(item.dayIndex)) byDay.set(item.dayIndex, []);
    byDay.get(item.dayIndex)!.push(item);
  }

  // Sort items within each day by sortOrder
  for (const items of byDay.values()) {
    items.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // Compute actual calendar dates for each dayIndex
  const tripStart = trip.startDate;
  function dayDate(dayIndex: number): string {
    if (!tripStart) return "unknown date";
    const d = new Date(tripStart);
    d.setDate(d.getDate() + dayIndex);
    return d.toISOString().split("T")[0];
  }

  const dayStrings: string[] = [];
  for (const [dayIndex, items] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    const itemLines = items.map(it =>
      `  - ${it.title} | type: ${it.type} | time: ${it.time} | sortOrder: ${it.sortOrder}`
    );
    dayStrings.push(`Day ${dayIndex + 1} — ${dayDate(dayIndex)}:\n${itemLines.join("\n")}`);
  }

  const scheduleString = `Trip: ${trip.title}
Destination: ${trip.destinationCity ?? "unknown"}, ${trip.destinationCountry ?? "unknown"}
Dates: ${fmt(trip.startDate)} to ${fmt(trip.endDate)}
Travellers: ${roles} (${childCount} ${childCount === 1 ? "child" : "children"})

Schedule:
${dayStrings.length > 0 ? dayStrings.join("\n\n") : "No scheduled items yet."}`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: `You are a knowledgeable family travel assistant reviewing a trip itinerary. Your job is to give 3–5 specific, actionable observations about this itinerary. Focus on: timing conflicts (e.g. checkout before departure), gaps (empty days before long flights), missing logistics (no airport transfer noted before early flight), pacing issues (too many activities in one day), and practical suggestions specific to the destination and family composition.

When a check-out item has no scheduled time, assume 11:00 — this is the industry standard hotel check-out time. Apply this assumption in your conflict analysis rather than treating the check-out as simply unscheduled.

Be specific — reference actual day numbers, item names, and times from the schedule. Do not be generic. Do not say "looks great overall."

Return ONLY a JSON array of 3–5 strings, each one observation. No preamble, no markdown, no backticks. Example format:
["Day 6 has a 09:58 train departure but check-out is not scheduled — add a check-out item for Day 6 morning.", "Day 2 and Day 4 are completely empty with no activities saved — consider adding saved items or a placeholder."]`,
      messages: [{ role: "user", content: scheduleString }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "[]";
    const observations = JSON.parse(text) as string[];
    return NextResponse.json({ observations });
  } catch {
    return NextResponse.json({
      observations: ["Unable to analyse itinerary at this time. Please try again."],
    });
  }
}
