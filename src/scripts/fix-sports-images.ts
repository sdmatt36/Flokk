// Backfill placePhotoUrl for sports-related SavedItem records missing photos.
// Tries stadium/ballpark/arena queries via Places textsearch + details + redirect follow.
// Correct field names: rawTitle, destinationCity, placePhotoUrl.

import { db } from '../lib/db';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

const SPORTS_REGEX = /\b(giants|twins|lakers|dodgers|yankees|cubs|sox|fc |united|athletic|baseball|football|basketball|soccer|nba|mlb|nfl|kbo)\b/i;

async function getStadiumPhoto(teamName: string, city: string): Promise<string | null> {
  const queries = [
    `${teamName} stadium ${city}`,
    `${teamName} ballpark ${city}`,
    `${teamName} arena ${city}`,
  ];

  for (const q of queries) {
    try {
      const searchRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const searchData = await searchRes.json() as { results?: { place_id: string }[] };
      const placeId = searchData.results?.[0]?.place_id;
      if (!placeId) { console.log(`  No place for: "${q}"`); continue; }

      const detailRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos,name&key=${GOOGLE_MAPS_API_KEY}`
      );
      const detailData = await detailRes.json() as { result?: { name?: string; photos?: { photo_reference: string }[] } };
      console.log(`  Place found: ${detailData.result?.name}`);
      const photoRef = detailData.result?.photos?.[0]?.photo_reference;
      if (!photoRef) continue;

      const redirectUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
      const photoRes = await fetch(redirectUrl, { redirect: 'follow' });
      const finalUrl = photoRes.url;
      if (finalUrl && finalUrl !== redirectUrl) return finalUrl;
    } catch (e) {
      console.log(`  Error for "${q}":`, e);
    }
  }
  return null;
}

async function backfill() {
  const items = await db.savedItem.findMany({
    where: {
      OR: [{ placePhotoUrl: null }, { placePhotoUrl: '' }],
      destinationCity: { not: null },
    },
    select: { id: true, rawTitle: true, destinationCity: true },
  });

  const sportsItems = items.filter(i => SPORTS_REGEX.test(i.rawTitle ?? ''));
  console.log(`Found ${sportsItems.length} sports items with no placePhotoUrl`);

  for (const item of sportsItems) {
    console.log(`\nProcessing: "${item.rawTitle}" in ${item.destinationCity}`);
    const photo = await getStadiumPhoto(item.rawTitle!, item.destinationCity!);

    if (photo) {
      await db.savedItem.update({
        where: { id: item.id },
        data: { placePhotoUrl: photo },
      });
      console.log(`✓ "${item.rawTitle}" → ${photo.slice(0, 80)}`);
    } else {
      console.log(`✗ No stadium photo found for "${item.rawTitle}"`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('\nDone');
}

backfill().catch(console.error);
