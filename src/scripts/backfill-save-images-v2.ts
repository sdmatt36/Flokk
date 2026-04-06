// Backfill placePhotoUrl with resolved final image URLs (not redirect URLs).
// Uses textsearch + place/details + redirect follow to get lh3.googleusercontent.com URLs.
// Correct field names: rawTitle, destinationCity, placePhotoUrl.

import { db } from '../lib/db';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

async function resolvePhoto(name: string, city: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${name} ${city}`);
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const searchData = await searchRes.json() as { results?: { place_id: string }[] };
    const placeId = searchData.results?.[0]?.place_id;
    if (!placeId) return null;

    const detailRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_MAPS_API_KEY}`
    );
    const detailData = await detailRes.json() as { result?: { photos?: { photo_reference: string }[] } };
    const photoRef = detailData.result?.photos?.[0]?.photo_reference;
    if (!photoRef) return null;

    const redirectUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
    const photoRes = await fetch(redirectUrl, { redirect: 'follow' });
    const finalUrl = photoRes.url;

    return (finalUrl && finalUrl !== redirectUrl) ? finalUrl : null;
  } catch {
    return null;
  }
}

async function backfill() {
  const skipTitles = ['Airbnb Rental', 'Airbnb Room', 'VRBO', 'Booking.com'];

  const items = await db.savedItem.findMany({
    where: {
      destinationCity: { not: null },
      rawTitle: { not: null },
    },
    select: { id: true, rawTitle: true, destinationCity: true, placePhotoUrl: true },
    take: 150,
  });

  console.log(`Processing ${items.length} items`);
  let updated = 0, skipped = 0, failed = 0;

  for (const item of items) {
    if (!item.rawTitle || item.rawTitle.length < 5 || !item.destinationCity) { skipped++; continue; }
    if (skipTitles.some(s => item.rawTitle!.startsWith(s))) {
      console.log(`SKIP (generic): "${item.rawTitle}"`);
      skipped++;
      continue;
    }

    const newUrl = await resolvePhoto(item.rawTitle, item.destinationCity);

    if (newUrl) {
      await db.savedItem.update({ where: { id: item.id }, data: { placePhotoUrl: newUrl } });
      console.log(`✓ "${item.rawTitle}" → ${newUrl.slice(0, 90)}`);
      updated++;
    } else {
      console.log(`✗ "${item.rawTitle}" in ${item.destinationCity} — no result`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`Done — updated: ${updated}, skipped: ${skipped}, failed: ${failed}`);
}

backfill().catch(console.error);
