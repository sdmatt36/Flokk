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

  const [trip, profile, flightBookings, itineraryItems, packingItems, contacts, keyInfo] =
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
      db.itineraryItem.findMany({
        where: { tripId: id, cancelledAt: null },
        orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          type: true,
          title: true,
          scheduledDate: true,
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
          status: true,
        },
      }),
      db.packingItem.findMany({
        where: { tripId: id },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
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

  // Only use hero image if it's an absolute public URL; local paths won't resolve in PDF renderer
  const heroImageUrl = trip.heroImageUrl?.startsWith("https://") ? trip.heroImageUrl : null;

  const generatedDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Dynamic import keeps @react-pdf/renderer out of the initial bundle
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { TripItineraryPDF } = await import("@/lib/pdf/TripItineraryPDF");

  const pdfProps = {
    tripTitle: trip.title,
    destinationCity: trip.destinationCity,
    destinationCountry: trip.destinationCountry,
    startDate: trip.startDate?.toISOString() ?? null,
    endDate: trip.endDate?.toISOString() ?? null,
    heroImageUrl,
    familyName: profile?.familyName ?? null,
    members: (profile?.members ?? []).map((m) => ({ name: m.name, role: m.role })),
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
      scheduledDate: i.scheduledDate,
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
      status: i.status,
    })),
    packingItems: packingItems.map((p) => ({
      category: p.category,
      name: p.name,
      assignedTo: p.assignedTo,
      packed: p.packed,
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

  // React.createElement return type is narrower than renderToBuffer's DocumentProps expectation;
  // the runtime type is correct since TripItineraryPDF returns <Document>.
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
