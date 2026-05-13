import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { canViewTrip } from "@/lib/trip-permissions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function getTrackedTotal(tripId: string, targetCurrency: string): Promise<number> {
  const [items, manuals] = await Promise.all([
    db.itineraryItem.findMany({
      where: { tripId, cancelledAt: null },
      select: { totalCost: true, currency: true, type: true },
    }),
    db.manualActivity.findMany({
      where: { tripId },
      select: { price: true, currency: true },
    }),
  ]);

  // Deduplicate lodging — check-in and check-out both store the same totalCost.
  // Only count LODGING once per unique totalCost+currency pair.
  const seenLodging = new Set<string>();
  const deduplicatedItems = items.filter((item) => {
    if (item.type === "LODGING") {
      const key = `${item.totalCost}-${item.currency}`;
      if (seenLodging.has(key)) return false;
      seenLodging.add(key);
    }
    return true;
  });

  const allCosts = [
    ...deduplicatedItems.map((i) => ({ amount: i.totalCost, currency: i.currency })),
    ...manuals.map((m) => ({ amount: m.price, currency: m.currency })),
  ].filter((c) => c.amount && c.amount > 0);

  if (allCosts.length === 0) return 0;

  // Fetch exchange rates relative to targetCurrency
  let rates: Record<string, number> = {};
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${targetCurrency}`);
    const data = await res.json() as { rates?: Record<string, number> };
    rates = data.rates ?? {};
  } catch {
    // If rate fetch fails, only convert what we can
  }

  function convertToTarget(amount: number, fromCurrency: string | null): number {
    if (!fromCurrency || fromCurrency === targetCurrency) return amount;
    const rate = rates[fromCurrency];
    if (!rate) return 0; // exclude unconvertible amounts rather than corrupt the total
    return amount / rate;
  }

  return Math.round(
    allCosts.reduce((sum, c) => sum + convertToTarget(c.amount!, c.currency), 0)
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { budgetTotal: true, budgetCurrency: true },
  });
  if (!trip || !(await canViewTrip(profileId, tripId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const targetCurrency = trip.budgetCurrency ?? "USD";
  const trackedTotal = await getTrackedTotal(tripId, targetCurrency);

  return NextResponse.json({
    budgetTotal: trip.budgetTotal,
    budgetCurrency: targetCurrency,
    trackedTotal,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const body = await req.json() as { budgetTotal?: number | null; budgetCurrency?: string; budgetRange?: string };
  const { budgetTotal, budgetCurrency, budgetRange } = body;

  const updated = await db.trip.update({
    where: { id: tripId },
    data: {
      ...(budgetTotal !== undefined && { budgetTotal: budgetTotal !== null ? Number(budgetTotal) : null }),
      ...(budgetCurrency !== undefined && { budgetCurrency }),
      ...(budgetRange !== undefined && { budgetRange: budgetRange as import("@prisma/client").BudgetRange }),
    },
  });

  return NextResponse.json({
    budgetTotal: updated.budgetTotal,
    budgetCurrency: updated.budgetCurrency,
  });
}
