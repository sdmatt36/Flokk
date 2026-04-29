import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { buildTripFromExtraction } from "@/lib/trip-builder";
import { sendTransactional } from "@/lib/loops";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { userId } = await auth();
  console.log("[GET /api/trips] clerkUserId:", userId ?? "null");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");
  const statusWhere = statusFilter?.toUpperCase() === "ALL"
    ? {}
    : statusFilter
    ? { status: statusFilter.toUpperCase() }
    : { status: { in: ["PLANNING", "ACTIVE"] } };
  const profileId = await resolveProfileId(userId);
  if (!profileId) {
    return NextResponse.json({ trips: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trips = await db.trip.findMany({
    where: {
      collaborators: { some: { familyProfileId: profileId, acceptedAt: { not: null } } },
      isPlacesLibrary: false,
      ...(statusWhere as object),
    },
    orderBy: { startDate: "asc" },
  });
  console.log("[GET /api/trips] returning", trips.length, "trips for familyProfile", profileId);
  return NextResponse.json(
    { trips: trips.map(t => ({ id: t.id, title: t.title, destinationCity: t.destinationCity, destinationCountry: t.destinationCountry, cities: t.cities, country: t.country, countries: t.countries, startDate: t.startDate, endDate: t.endDate, status: t.status, isPlacesLibrary: t.isPlacesLibrary })) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });
  const familyProfile = await db.familyProfile.findUnique({ where: { id: profileId } });
  if (!familyProfile) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const body = await req.json();
  const { status, isAnonymous } = body as { status?: string; isAnonymous?: boolean };

  let cities: string[] = [];
  let country: string | null = null;

  if (Array.isArray(body.cities) && body.cities.length > 0 && typeof body.country === "string" && body.country.trim().length > 0) {
    // New chip-based submission
    cities = (body.cities as string[]).map((c) => c.trim()).filter(Boolean);
    country = body.country.trim();
  } else if (typeof body.destination === "string" && body.destination.trim().length > 0) {
    // Legacy fallback: comma-parse for old callers (past-trip import, steal-to-new, etc.)
    const parts = body.destination.split(",").map((s: string) => s.trim());
    cities = [parts[0] ?? body.destination];
    country = parts[1] ?? null;
  } else {
    return NextResponse.json({ error: "Missing destination" }, { status: 400 });
  }

  let countries: string[] = [];
  if (Array.isArray(body.countries) && body.countries.length > 0) {
    countries = Array.from(new Set(
      (body.countries as unknown[])
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        .map((c) => c.trim())
    ));
  } else if (country) {
    countries = [country];
  }

  const startDate: string | null = typeof body.startDate === "string" && body.startDate.length > 0
    ? body.startDate : null;
  const endDate: string | null = typeof body.endDate === "string" && body.endDate.length > 0
    ? body.endDate : null;

  const builtData = await buildTripFromExtraction({
    cities,
    country,
    countries,
    startDate,
    endDate,
    statusOverride: status === "COMPLETED" ? "COMPLETED" : "PLANNING",
    isAnonymous: isAnonymous ?? true,
  });

  const trip = await db.trip.create({
    data: { ...builtData, familyProfileId: familyProfile.id },
  });

  // Loops: fire first-trip-created if this is their first trip
  try {
    const tripCount = await db.trip.count({ where: { familyProfileId: familyProfile.id } });
    if (tripCount === 1) {
      const clerkUser = await currentUser();
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? "";
      const firstName = clerkUser?.firstName ?? "";
      await sendTransactional(email, "cmn5lhq4k0uk60iyud4tn6qa1", {
        firstName,
        tripName: trip.title,
        tripDestination: trip.destinationCity ?? "",
      });
    }
  } catch (e) {
    console.error("[loops] first-trip trigger failed:", e);
  }

  return NextResponse.json({ tripId: trip.id });
}
