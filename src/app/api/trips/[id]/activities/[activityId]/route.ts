import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { normalizeCategorySlug } from "@/lib/categories";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";

async function getCityForDay(tripId: string, dayDate: string): Promise<string> {
  const lodging = await db.itineraryItem.findFirst({
    where: {
      tripId,
      type: "LODGING",
      toCity: { not: null },
      scheduledDate: { lte: dayDate },
    },
    orderBy: { scheduledDate: "desc" },
    select: { toCity: true },
  });
  if (lodging?.toCity) return lodging.toCity;

  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { destinationCity: true, destinationCountry: true },
  });
  return [trip?.destinationCity, trip?.destinationCountry].filter(Boolean).join(", ");
}


export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId, activityId } = await params;
  const body = await request.json();
  console.log('[PATCH activity] activityId:', activityId, 'tripId:', tripId, 'body:', JSON.stringify(body));

  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { startDate: true, destinationCity: true, destinationCountry: true } });

  // Recalculate dayIndex if date is being updated
  if (body.date && trip?.startDate) {
    const rawStart = new Date(trip.startDate);
    const shiftedStart = new Date(rawStart.getTime() + 12 * 60 * 60 * 1000);
    const start = new Date(shiftedStart.getUTCFullYear(), shiftedStart.getUTCMonth(), shiftedStart.getUTCDate());
    const [dy, dm, dd] = body.date.split("-").map(Number);
    const dep = new Date(dy, dm - 1, dd);
    body.dayIndex = Math.round((dep.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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
    type: clientType,
  } = body;

  // Geocode if venueName or address is being set and current coords are null
  let lat: number | undefined = undefined;
  let lng: number | undefined = undefined;
  if (venueName || address) {
    const existing = await db.manualActivity.findUnique({ where: { id: activityId }, select: { lat: true, date: true } });
    if (existing?.lat == null) {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
      if (apiKey) {
        try {
          const activityDate = body.date ?? existing?.date ?? "";
          const activityCity = activityDate ? await getCityForDay(tripId, activityDate) : [trip?.destinationCity, trip?.destinationCountry].filter(Boolean).join(", ");
          const geocodeQuery = [venueName, address, activityCity].filter(Boolean).join(", ");
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(geocodeQuery)}&key=${apiKey}`;
          const geoRes = await fetch(geocodeUrl);
          const geoData = await geoRes.json();
          const location = geoData.results?.[0]?.geometry?.location;
          lat = location?.lat ?? undefined;
          lng = location?.lng ?? undefined;
          console.log(`[GEOCODE] city for day=${activityDate}: "${activityCity}" | query="${geocodeQuery}" result=${lat},${lng}`);
        } catch { /* geocoding optional */ }
      }
    }
  }

  const resolvedNewType = clientType !== undefined ? (normalizeCategorySlug(clientType) ?? clientType) : undefined;

  const updated = await db.manualActivity.update({
    where: { id: activityId },
    data: {
      ...(title !== undefined && { title }),
      ...(date !== undefined && { date }),
      ...(body.dayIndex !== undefined && { dayIndex: body.dayIndex }),
      ...(time !== undefined && { time: time ?? null }),
      ...(endTime !== undefined && { endTime: endTime ?? null }),
      ...(venueName !== undefined && { venueName: venueName ?? null }),
      ...(address !== undefined && { address: address ?? null }),
      ...(lat !== undefined && { lat, lng }),
      ...(website !== undefined && { website: website ?? null }),
      ...(price !== undefined && { price: price ? parseFloat(price) : null }),
      ...(currency !== undefined && { currency }),
      ...(notes !== undefined && { notes: notes ?? null }),
      ...(status !== undefined && { status }),
      ...(confirmationCode !== undefined && { confirmationCode: confirmationCode ?? null }),
      ...(resolvedNewType !== undefined && { type: resolvedNewType }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
    select: {
      id: true, tripId: true, title: true, date: true, time: true, endTime: true,
      venueName: true, address: true, lat: true, lng: true, website: true, price: true,
      currency: true, notes: true, status: true, confirmationCode: true, city: true,
      type: true, imageUrl: true, dayIndex: true, sortOrder: true, tourId: true,
      deletedAt: true, createdAt: true, shareToken: true, savedItemId: true,
    },
  });

  // Forward categoryTags and/or type changes to the paired SavedItem.
  // categoryTags is the canonical multi-category write path.
  // type change also syncs so both models stay consistent.
  if (updated.savedItemId) {
    const savedItemUpdate: Record<string, unknown> = {};
    if (Array.isArray(body.categoryTags)) {
      const normalized = normalizeAndDedupeCategoryTags(
        (body.categoryTags as string[]).map((t) => normalizeCategorySlug(t) ?? t)
      );
      savedItemUpdate.categoryTags = { set: normalized };
    } else if (resolvedNewType !== undefined) {
      savedItemUpdate.categoryTags = { set: [resolvedNewType] };
    }
    if (notes !== undefined) savedItemUpdate.notes = notes ?? null;
    if (title !== undefined) savedItemUpdate.rawTitle = title;
    if (Object.keys(savedItemUpdate).length > 0) {
      db.savedItem.update({
        where: { id: updated.savedItemId },
        data: savedItemUpdate,
      }).catch((e) => console.error("[PATCH activity] SavedItem sync failed:", e));
    }
  }

  // Increment budgetSpent if a cost was provided and currency matches trip's budgetCurrency
  if (price) {
    const cost = parseFloat(price);
    if (!isNaN(cost) && cost > 0) {
      const tripForBudget = await db.trip.findUnique({ where: { id: tripId }, select: { budgetCurrency: true } });
      const activityCurrency = currency ?? "USD";
      if (tripForBudget && (!tripForBudget.budgetCurrency || tripForBudget.budgetCurrency === activityCurrency)) {
        db.trip.update({
          where: { id: tripId },
          data: {
            budgetSpent: { increment: cost },
            budgetCurrency: tripForBudget.budgetCurrency ?? activityCurrency,
          },
        }).catch(() => {});
      }
    }
  }

  console.log('[PATCH activity] response:', JSON.stringify({ id: updated.id, dayIndex: updated.dayIndex, time: updated.time, sortOrder: updated.sortOrder }));
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
