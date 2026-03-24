import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTripCoverImage } from "@/lib/destination-images";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  console.log("[GET /api/trips] clerkUserId:", userId ?? "null");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { familyProfile: { include: { trips: { where: { status: { in: ["PLANNING", "ACTIVE"] } }, orderBy: { startDate: "asc" } } } } },
  });
  const trips = user?.familyProfile?.trips ?? [];
  console.log("[GET /api/trips] returning", trips.length, "trips for familyProfile", user?.familyProfile?.id ?? "none");
  return NextResponse.json(
    { trips: trips.map(t => ({ id: t.id, title: t.title, destinationCity: t.destinationCity, destinationCountry: t.destinationCountry, startDate: t.startDate })) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

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
  const { destination, startDate, endDate, status } = body as {
    destination: string;
    startDate: string;
    endDate: string;
    status?: string;
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

  // Pre-populate heroImageUrl from static map (instant, no API call needed)
  const staticCover = getTripCoverImage(destinationCity, destinationCountry);

  const trip = await db.trip.create({
    data: {
      familyProfileId: user.familyProfile.id,
      title,
      destinationCity,
      destinationCountry,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: (status === "COMPLETED" ? "COMPLETED" : "PLANNING") as "PLANNING" | "COMPLETED",
      privacy: "PRIVATE",
      heroImageUrl: staticCover ?? null,
    },
  });

  return NextResponse.json({ tripId: trip.id });
}
