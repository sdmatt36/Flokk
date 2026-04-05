import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";


export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, activityId } = await params;
  const body = await request.json();

  // Recalculate dayIndex if date is being updated
  if (body.date) {
    const trip = await db.trip.findUnique({ where: { id: tripId }, select: { startDate: true } });
    if (trip?.startDate) {
      const rawStart = new Date(trip.startDate);
      const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
      const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
      const [dy, dm, dd] = body.date.split("-").map(Number);
      const dep = new Date(dy, dm - 1, dd);
      body.dayIndex = Math.round((dep.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  const {
    title,
    date,
    time,
    endTime,
    venueName,
    address,
    website,
    price,
    currency,
    notes,
    status,
    confirmationCode,
  } = body;

  // Geocode if venueName or address is being set and current coords are null
  let lat: number | undefined = undefined;
  let lng: number | undefined = undefined;
  if (venueName || address) {
    const existing = await db.manualActivity.findUnique({ where: { id: activityId }, select: { lat: true } });
    if (existing?.lat == null) {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
      if (apiKey) {
        try {
          const query = encodeURIComponent([venueName, address].filter(Boolean).join(" "));
          const geoRes = await fetch(
            `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=geometry&key=${apiKey}`
          );
          const geoData = await geoRes.json();
          const loc = geoData.candidates?.[0]?.geometry?.location;
          if (loc) { lat = loc.lat; lng = loc.lng; }
        } catch { /* geocoding optional */ }
      }
    }
  }

  const updated = await db.manualActivity.update({
    where: { id: activityId },
    data: {
      ...(title !== undefined && { title }),
      ...(date !== undefined && { date }),
      ...(body.dayIndex !== undefined && { dayIndex: body.dayIndex }),
      time: time ?? null,
      endTime: endTime ?? null,
      ...(venueName !== undefined && { venueName: venueName ?? null }),
      ...(address !== undefined && { address: address ?? null }),
      ...(lat !== undefined && { lat, lng }),
      ...(website !== undefined && { website: website ?? null }),
      ...(price !== undefined && { price: price ? parseFloat(price) : null }),
      ...(currency !== undefined && { currency }),
      ...(notes !== undefined && { notes: notes ?? null }),
      ...(status !== undefined && { status }),
      ...(confirmationCode !== undefined && { confirmationCode: confirmationCode ?? null }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activityId } = await params;

  await db.manualActivity.delete({ where: { id: activityId } });

  return NextResponse.json({ success: true });
}
