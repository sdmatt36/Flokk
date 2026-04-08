import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const services = await db.tripService.findMany({ where: { tripId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ services });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, serviceType, phone, whatsapp, email, rating, recommend, notes } = body as {
    name: string;
    serviceType: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    rating?: number;
    recommend?: boolean;
    notes?: string;
  };
  if (!name || !serviceType) return NextResponse.json({ error: "name and serviceType required" }, { status: 400 });

  const service = await db.tripService.create({
    data: { tripId, name, serviceType, phone: phone ?? null, whatsapp: whatsapp ?? null, email: email ?? null, rating: rating ?? null, recommend: recommend ?? true, notes: notes ?? null },
  });
  return NextResponse.json({ service });
}
