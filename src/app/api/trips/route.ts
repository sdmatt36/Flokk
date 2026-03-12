import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });

  if (!user?.familyProfile) {
    return NextResponse.json({ error: "No family profile" }, { status: 400 });
  }

  const body = await req.json();
  const { destination, startDate, endDate } = body as {
    destination: string;
    startDate: string;
    endDate: string;
  };

  if (!destination || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Parse destination into city / country
  const parts = destination.split(",").map((s) => s.trim());
  const destinationCity = parts[0] ?? destination;
  const destinationCountry = parts[1] ?? null;

  // Build a readable title
  const start = new Date(startDate);
  const monthYear = start.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  const title = `${destinationCity} ${monthYear.replace(" ", " '")}`;

  const trip = await db.trip.create({
    data: {
      familyProfileId: user.familyProfile.id,
      title,
      destinationCity,
      destinationCountry,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: "PLANNING",
      privacy: "PRIVATE",
    },
  });

  return NextResponse.json({ tripId: trip.id });
}
