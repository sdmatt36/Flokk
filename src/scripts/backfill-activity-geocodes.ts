// Backfill lat/lng for ManualActivity records missing coordinates.
// ManualActivity uses lat/lng (not latitude/longitude like ItineraryItem).
// Trip uses destinationCity/destinationCountry (not destination).

import { db } from '../lib/db';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;

async function backfill() {
  const items = await db.manualActivity.findMany({
    where: {
      OR: [{ lat: null }, { lng: null }],
    },
    include: {
      trip: { select: { destinationCity: true, destinationCountry: true } },
    },
  });

  console.log(`Found ${items.length} activities with missing coordinates`);

  for (const item of items) {
    const locationContext = [item.trip.destinationCity, item.trip.destinationCountry]
      .filter(Boolean)
      .join(', ');
    const query = [item.venueName ?? item.title, item.address, locationContext]
      .filter(Boolean)
      .join(', ');

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;

    try {
      const res = await fetch(url);
      const data = await res.json() as { results?: { geometry: { location: { lat: number; lng: number } } }[] };
      const loc = data.results?.[0]?.geometry?.location;

      if (loc?.lat && loc?.lng) {
        await db.manualActivity.update({
          where: { id: item.id },
          data: { lat: loc.lat, lng: loc.lng },
        });
        console.log(`✓ ${item.title}: ${loc.lat}, ${loc.lng}`);
      } else {
        console.log(`✗ FAILED: ${item.title} (query: "${query}")`);
      }
    } catch (e) {
      console.log(`✗ ERROR: ${item.title} — ${e}`);
    }

    await new Promise(r => setTimeout(r, 200)); // rate limit
  }

  console.log('Backfill complete');
}

backfill().catch(console.error);
