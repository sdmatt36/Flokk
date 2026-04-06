import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });
  if (!user?.familyProfile) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { familyProfileId: true, budgetTotal: true, budgetSpent: true, budgetCurrency: true },
  });
  if (!trip || trip.familyProfileId !== user.familyProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { budgetTotal, budgetSpent, budgetCurrency } = trip;
  const spent = budgetSpent ?? 0;
  const remaining = budgetTotal != null ? budgetTotal - spent : null;
  const percentUsed = budgetTotal != null && budgetTotal > 0 ? (spent / budgetTotal) * 100 : null;

  return NextResponse.json({ budgetTotal, budgetSpent: spent, budgetCurrency, remaining, percentUsed });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const body = await req.json() as { budgetTotal?: number | null; budgetCurrency?: string };
  const { budgetTotal, budgetCurrency } = body;

  console.log("[BUDGET PATCH] tripId:", tripId, "budgetTotal:", budgetTotal, "budgetCurrency:", budgetCurrency);

  const updated = await db.trip.update({
    where: { id: tripId },
    data: {
      ...(budgetTotal !== undefined && { budgetTotal: Number(budgetTotal) }),
      ...(budgetCurrency !== undefined && { budgetCurrency }),
    },
  });

  console.log("[BUDGET PATCH] result:", updated.budgetTotal, updated.budgetCurrency);

  return NextResponse.json({
    budgetTotal: updated.budgetTotal,
    budgetSpent: updated.budgetSpent ?? 0,
    budgetCurrency: updated.budgetCurrency,
  });
}
