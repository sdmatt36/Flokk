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
  const user = await db.user.findUnique({ where: { clerkId: userId }, include: { familyProfile: true } });
  if (!user?.familyProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== user.familyProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tips = await db.tripTip.findMany({ where: { tripId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ tips });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const user = await db.user.findUnique({ where: { clerkId: userId }, include: { familyProfile: true } });
  if (!user?.familyProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== user.familyProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { content, category } = body as { content: string; category: string };
  if (!content || !category) return NextResponse.json({ error: "content and category required" }, { status: 400 });

  const tip = await db.tripTip.create({ data: { tripId, content, category } });
  return NextResponse.json({ tip });
}
