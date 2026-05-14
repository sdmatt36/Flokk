import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { canViewTrip } from "@/lib/trip-permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });

  if (!(await canViewTrip(profileId, tripId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bookings = await db.cruiseBooking.findMany({
    where: { tripId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      ports: {
        where: { cancelledAt: null },
        orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          title: true,
          fromCity: true,
          arrivalTime: true,
          departureTime: true,
          dayIndex: true,
          sortOrder: true,
        },
      },
    },
  });

  return NextResponse.json({ bookings });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json({ error: "Use /cruise-bookings/[bookingId]" }, { status: 405 });
}
