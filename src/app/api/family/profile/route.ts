import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });
  if (!user?.familyProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ familyProfile: user.familyProfile });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });
  if (!user?.familyProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();

  const updated = await db.familyProfile.update({
    where: { id: user.familyProfile.id },
    data: {
      ...(body.familyName !== undefined && { familyName: body.familyName || null }),
      ...(body.homeCity !== undefined && { homeCity: body.homeCity || null }),
      ...(body.homeCountry !== undefined && { homeCountry: body.homeCountry || null }),
      ...(body.travelFrequency && { travelFrequency: body.travelFrequency }),
      ...(body.budgetRange && { budgetRange: body.budgetRange }),
      ...(body.accessibilityNotes !== undefined && { accessibilityNotes: body.accessibilityNotes || null }),
    },
  });

  return NextResponse.json({ familyProfile: updated });
}
