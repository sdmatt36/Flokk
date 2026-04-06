// Backfill placePhotoUrl for SavedItem records using Google Places textsearch + details.
// Schema fields: rawTitle (not title), destinationCity (not city), placePhotoUrl (not mediaUrl).

import { db } from '../lib/db';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

async function getGooglePlacesPhoto(name: string, city: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${name} ${city}`);
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${GOOGLE_MAPS_API_KEY}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json() as { results?: { place_id: string }[] };
    const placeId = searchData.results?.[0]?.place_id;
    if (!placeId) return null;

    const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_MAPS_API_KEY}`;
    const detailRes = await fetch(detailUrl);
    const detailData = await detailRes.json() as { result?: { photos?: { photo_reference: string }[] } };
    const photoRef = detailData.result?.photos?.[0]?.photo_reference;
    if (!photoRef) return null;

    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
  } catch {
    return null;
  }
}

async function backfill() {
  const items = await db.savedItem.findMany({
    where: {
      destinationCity: { not: null },
      rawTitle: { not: null },
    },
    select: { id: true, rawTitle: true, destinationCity: true, placePhotoUrl: true },
    take: 100,
  });

  console.log(`Processing ${items.length} saved items`);

  for (const item of items) {
    if (!item.rawTitle || item.rawTitle.length < 5 || !item.destinationCity) {
      console.log(`SKIP: "${item.rawTitle}" — no title or city`);
      continue;
    }

    const newUrl = await getGooglePlacesPhoto(item.rawTitle, item.destinationCity);

    if (newUrl && newUrl !== item.placePhotoUrl) {
      await db.savedItem.update({
        where: { id: item.id },
        data: { placePhotoUrl: newUrl },
      });
      console.log(`✓ "${item.rawTitle}" — updated`);
      console.log(`  OLD: ${(item.placePhotoUrl ?? 'null').slice(0, 80)}`);
      console.log(`  NEW: ${newUrl.slice(0, 80)}`);
    } else if (!newUrl) {
      console.log(`✗ "${item.rawTitle}" in ${item.destinationCity} — no Places result, keeping existing`);
    } else {
      console.log(`= "${item.rawTitle}" — URL unchanged`);
    }

    await new Promise(r => setTimeout(r, 300)); // rate limit
  }

  console.log('Backfill complete');
}

backfill().catch(console.error);
