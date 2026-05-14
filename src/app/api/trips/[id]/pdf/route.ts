import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import React from "react";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getTripAccess } from "@/lib/trip-permissions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const access = await getTripAccess(profileId, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [trip, profile, flightBookings, cruiseBookings, itineraryItems, spots, activities, flightLegs, contacts, keyInfo] =
    await Promise.all([
      db.trip.findUnique({
        where: { id },
        select: {
          title: true,
          destinationCity: true,
          destinationCountry: true,
          startDate: true,
          endDate: true,
          heroImageUrl: true,
        },
      }),
      db.familyProfile.findUnique({
        where: { id: profileId },
        select: {
          familyName: true,
          members: { select: { name: true, role: true } },
        },
      }),
      db.flightBooking.findMany({
        where: { tripId: id },
        orderBy: { sortOrder: "asc" },
        include: { flights: { orderBy: { sortOrder: "asc" } } },
      }),
      db.cruiseBooking.findMany({
        where: { tripId: id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          ports: {
            where: { cancelledAt: null },
            orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }],
            select: { id: true, title: true, fromCity: true, arrivalTime: true, departureTime: true, dayIndex: true, sortOrder: true },
          },
        },
      }),
      // Email-imported confirmed bookings (LODGING, FLIGHT, TRAIN, ACTIVITY, etc.)
      db.itineraryItem.findMany({
        where: { tripId: id, cancelledAt: null },
        orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          type: true,
          title: true,
          departureTime: true,
          arrivalTime: true,
          fromCity: true,
          toCity: true,
          fromAirport: true,
          toAirport: true,
          confirmationCode: true,
          notes: true,
          address: true,
          dayIndex: true,
          sortOrder: true,
        },
      }),
      // Saved spots the user assigned to a day (restaurants, attractions, etc.)
      db.savedItem.findMany({
        where: { tripId: id, dayIndex: { not: null }, deletedAt: null, sourceMethod: { not: "manual_activity" } },
        orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          rawTitle: true,
          rawDescription: true,
          startTime: true,
          categoryTags: true,
          destinationCity: true,
          dayIndex: true,
          sortOrder: true,
        },
      }),
      // Manually added activities
      db.manualActivity.findMany({
        where: { tripId: id, deletedAt: null },
        orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }, { time: "asc" }],
        select: {
          id: true,
          title: true,
          time: true,
          endTime: true,
          venueName: true,
          address: true,
          notes: true,
          dayIndex: true,
          sortOrder: true,
          type: true,
          date: true,
        },
      }),
      // Individual flight legs — used to look up flight numbers for FLIGHT itinerary items
      db.flight.findMany({
        where: { tripId: id },
        select: { flightNumber: true, fromAirport: true, confirmationCode: true },
      }),
      db.tripContact.findMany({
        where: { tripId: id },
        orderBy: { createdAt: "asc" },
      }),
      db.tripKeyInfo.findMany({
        where: { tripId: id },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only use hero image if it's a publicly accessible https URL
  const heroImageUrl = trip.heroImageUrl?.startsWith("https://") ? trip.heroImageUrl : null;

  const generatedDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Build lookup: confirmationCode+fromAirport → flightNumber for FLIGHT itinerary items
  const flightNumLookup = new Map<string, string>();
  for (const leg of flightLegs) {
    if (leg.confirmationCode && leg.fromAirport) {
      flightNumLookup.set(`${leg.confirmationCode}:${leg.fromAirport}`, leg.flightNumber);
    }
  }

  // Compute dayIndex for manual activities that don't have it set, using trip.startDate + activity.date
  const tripStartDate = trip.startDate ? new Date(trip.startDate) : null;
  function computeDayIndex(dateStr: string): number | null {
    if (!tripStartDate) return null;
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const actDate = new Date(y, m - 1, d);
      const start = new Date(tripStartDate.getFullYear(), tripStartDate.getMonth(), tripStartDate.getDate());
      const diff = Math.round((actDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 ? diff : null;
    } catch {
      return null;
    }
  }

  const { TripItineraryPDF } = await import("@/lib/pdf/TripItineraryPDF");
  const { renderToBuffer } = await import("@react-pdf/renderer");

  const pdfProps = {
    tripTitle: trip.title,
    destinationCity: trip.destinationCity,
    destinationCountry: trip.destinationCountry,
    startDate: trip.startDate?.toISOString() ?? null,
    endDate: trip.endDate?.toISOString() ?? null,
    heroImageUrl,
    familyName: profile?.familyName ?? null,
    members: (profile?.members ?? []).map((m) => ({ name: m.name, role: m.role })),
    cruiseBookings: cruiseBookings.map((cb) => ({
      id: cb.id,
      confirmationCode: cb.confirmationCode,
      cruiseLine: cb.cruiseLine,
      shipName: cb.shipName,
      embarkPort: cb.embarkPort,
      disembarkPort: cb.disembarkPort,
      embarkDate: cb.embarkDate,
      disembarkDate: cb.disembarkDate,
      cabinType: cb.cabinType,
      cabinNumber: cb.cabinNumber,
      notes: cb.notes,
      ports: cb.ports.map((p) => ({
        id: p.id,
        title: p.title,
        fromCity: p.fromCity,
        arrivalTime: p.arrivalTime,
        departureTime: p.departureTime,
        dayIndex: p.dayIndex,
        sortOrder: p.sortOrder,
      })),
    })),
    flightBookings: flightBookings.map((fb) => ({
      id: fb.id,
      confirmationCode: fb.confirmationCode,
      airline: fb.airline,
      cabinClass: fb.cabinClass,
      seatNumbers: fb.seatNumbers,
      notes: fb.notes,
      flights: fb.flights.map((f) => ({
        flightNumber: f.flightNumber,
        airline: f.airline,
        fromAirport: f.fromAirport,
        fromCity: f.fromCity,
        toAirport: f.toAirport,
        toCity: f.toCity,
        departureDate: f.departureDate,
        departureTime: f.departureTime,
        arrivalDate: f.arrivalDate,
        arrivalTime: f.arrivalTime,
        duration: f.duration,
        cabinClass: f.cabinClass,
        seatNumbers: f.seatNumbers,
        type: f.type,
      })),
    })),
    itineraryItems: itineraryItems.map((i) => ({
      id: i.id,
      type: i.type,
      title: i.title,
      flightNumber:
        i.type === "FLIGHT" && i.confirmationCode && i.fromAirport
          ? (flightNumLookup.get(`${i.confirmationCode}:${i.fromAirport}`) ?? null)
          : null,
      departureTime: i.departureTime,
      arrivalTime: i.arrivalTime,
      fromCity: i.fromCity,
      toCity: i.toCity,
      fromAirport: i.fromAirport,
      toAirport: i.toAirport,
      confirmationCode: i.confirmationCode,
      notes: i.notes,
      address: i.address,
      dayIndex: i.dayIndex,
      sortOrder: i.sortOrder,
    })),
    spots: spots
      .filter((s) => s.dayIndex !== null && s.rawTitle !== null)
      .map((s) => ({
        id: s.id,
        rawTitle: s.rawTitle as string,
        rawDescription: s.rawDescription,
        startTime: s.startTime,
        categoryTags: s.categoryTags,
        destinationCity: s.destinationCity,
        dayIndex: s.dayIndex as number,
        sortOrder: s.sortOrder,
      })),
    activities: activities.map((a) => ({
      id: a.id,
      title: a.title,
      time: a.time,
      endTime: a.endTime,
      venueName: a.venueName,
      address: a.address,
      notes: a.notes,
      dayIndex: a.dayIndex ?? computeDayIndex(a.date),
      sortOrder: a.sortOrder,
      type: a.type,
    })),
    contacts: contacts.map((c) => ({
      name: c.name,
      role: c.role,
      phone: c.phone,
      whatsapp: c.whatsapp,
      email: c.email,
      notes: c.notes,
    })),
    keyInfo: keyInfo.map((k) => ({ label: k.label, value: k.value })),
    generatedDate,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(TripItineraryPDF, pdfProps) as any);

  const safeName = trip.title.replace(/[^a-z0-9]/gi, "-").toLowerCase();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}-itinerary.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
