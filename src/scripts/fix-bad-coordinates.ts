// Re-geocode ManualActivity records using day-aware city context.
// Fixes multi-city trips where activities were geocoded against the primary trip city.
// ItineraryItem: scheduledDate (String), toCity. ManualActivity: lat/lng, date.
// Trip: destinationCity/destinationCountry (no destination field).

import { db } from '../lib/db';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

async function getCityForDay(tripId: string, dayDate: string): Promise<string> {
  const lodging = await db.itineraryItem.findFirst({
    where: {
      tripId,
      type: 'LODGING',
      toCity: { not: null },
      scheduledDate: { lte: dayDate },
    },
    orderBy: { scheduledDate: 'desc' },
    select: { toCity: true },
  });
  if (lodging?.toCity) return lodging.toCity;

  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { destinationCity: true, destinationCountry: true },
  });
  return [trip?.destinationCity, trip?.destinationCountry].filter(Boolean).join(', ');
}

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json() as { results?: { geometry: { location: { lat: number; lng: number } } }[] };
  const loc = data.results?.[0]?.geometry?.location;
  return loc ? { lat: loc.lat, lng: loc.lng } : null;
}

async function backfill() {
  const items = await db.manualActivity.findMany({
    select: { id: true, tripId: true, title: true, venueName: true, date: true, lat: true, lng: true },
  });

  console.log(`Re-geocoding ${items.length} manual activities with day-aware city context`);

  for (const item of items) {
    const city = await getCityForDay(item.tripId, item.date);
    const query = [item.title, item.venueName, city].filter(Boolean).join(', ');
    const coords = await geocode(query);

    if (coords) {
      await db.manualActivity.update({
        where: { id: item.id },
        data: { lat: coords.lat, lng: coords.lng },
      });
      console.log(`✓ "${item.title}" | city: ${city} | ${coords.lat}, ${coords.lng}`);
    } else {
      console.log(`✗ FAILED: "${item.title}" | query: "${query}"`);
    }
    await new Promise(r => setTimeout(r, 250));
  }
  console.log('Done');
}

backfill().catch(console.error);
