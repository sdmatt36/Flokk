// Server-side Unsplash search helper. Uses NEXT_PUBLIC_UNSPLASH_ACCESS_KEY
// (same key as the admin photo picker, readable server-side without the
// NEXT_PUBLIC_ restriction since server bundles can access it directly).
//
// Rate limit: Unsplash free tier = 50 requests/hour. Callers are responsible
// for throttling — this function does not implement delays or retries.

export interface UnsplashPhoto {
  url: string;       // urls.regular — 1080px wide, suitable for card heroes
  credit: string;    // "Photo by {name} on Unsplash"
  sourceUrl: string; // links.html — the photo page on Unsplash (required for attribution)
}

export async function searchUnsplashPhotoWithCredit(
  query: string,
): Promise<UnsplashPhoto | null> {
  const key =
    process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY ??
    process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  let res: Response;
  try {
    res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&client_id=${key}`,
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = await res.json();
  const result = data.results?.[0];
  if (!result) return null;

  return {
    url: result.urls.regular,
    credit: `Photo by ${result.user.name} on Unsplash`,
    sourceUrl: result.links.html,
  };
}
