// Google Places API image resolution.
// Requires GOOGLE_PLACES_API_KEY in env.
// Returns undefined if key is not configured or lookup fails.

export async function resolveVenueImage(
  placeName: string,
  city?: string
): Promise<string | undefined> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? null;
  if (!apiKey) return undefined;

  try {
    const query = [placeName, city].filter(Boolean).join(" ");
    const findUrl =
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
      `?input=${encodeURIComponent(query)}&inputtype=textquery&fields=photos&key=${apiKey}`;

    const findRes = await fetch(findUrl, { signal: AbortSignal.timeout(5000) });
    if (!findRes.ok) return undefined;

    const findData = await findRes.json();
    const photoRef = findData.candidates?.[0]?.photos?.[0]?.photo_reference;
    if (!photoRef) return undefined;

    return (
      `https://maps.googleapis.com/maps/api/place/photo` +
      `?maxwidth=800&photoreference=${photoRef}&key=${apiKey}`
    );
  } catch {
    return undefined;
  }
}
