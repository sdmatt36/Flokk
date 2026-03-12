// ============================================
// EXTRACTION PIPELINE — DATA SOURCES & LAYERS
// ============================================
//
// When a user saves a URL, enrich it through
// these sources IN ORDER:
//
// LAYER 1: Page metadata (always run)
//   - Fetch Open Graph tags: og:title, og:description,
//     og:image, og:url
//   - Extract JSON-LD structured data if present
//     (many restaurant/hotel sites use schema.org)
//   - Detect platform: Instagram, TikTok, Google Maps,
//     Airbnb, Booking.com, direct URL
//   - Confidence: varies — structured data = high,
//     plain text = low
//
// LAYER 2: Claude classification (always run)
//   - Input: title + description + URL + platform
//   - Output: destination, category_tags, interest_keys,
//     item_type, confidence score
//   - Claude INFERS attributes from language:
//     "perfect for families" → kid_friendly: true
//     "cocktail bar, 21+" → kid_friendly: false
//     "cash only" → payment_cash_only: true
//     "book ahead" → requires_booking: true
//   - These are INFERENCES, not verified facts
//   - Store with confidence < 0.7 flagged for review
//   - Display inferred attributes with "families say"
//     style labeling, not as hard facts
//
// LAYER 3: Google Places API (run if location found)
//   - Query: place name + city from Layer 2 output
//   - Returns VERIFIED structured data:
//     * Opening hours (by day)
//     * Price level (1-4)
//     * Phone, website
//     * Place attributes: wheelchair_accessible,
//       good_for_children, reservations_required,
//       serves_vegetarian_food, etc.
//   - Store as verified: true on the attribute
//   - Display with "verified" indicator in UI
//   - API cost: ~$0.017 per lookup — only run when
//     confidence of location match > 0.8
//
// LAYER 4: Community data (async, accumulates over time)
//   - When other families save or review same place,
//     their tags and notes enrich the shared record
//   - Community attributes: age_appropriate_min,
//     stroller_friendly, loud_environment, wait_times,
//     kid_menu_available, etc.
//   - Source labeled as "X families confirm this"
//   - Weighted by recency and contributor tier
//   - This is the highest-trust source for
//     family-specific attributes
//
// CONFIDENCE & DISPLAY RULES:
//   - verified (Google Places): show as fact
//     e.g. "Opens at 10am" "$" "Reservations required"
//   - community (3+ families): show as "families say"
//     e.g. "Families say: great for kids under 8"
//   - inferred (Claude): show softly or not at all
//     e.g. "May be suitable for ages 6+"
//   - unknown: don't show — silence > wrong info
//
// AGE APPROPRIATENESS SPECIFICALLY:
//   - Never show a hard age restriction unless it comes
//     from Google Places attributes OR 3+ community tags
//   - Claude inference on age is low confidence —
//     use only to pre-populate for user to confirm
//   - User can manually set/override age suitability
//     on any saved item
//
// CASH ONLY / PAYMENT SPECIFICALLY:
//   - Google Places returns payment_options attribute
//   - This is reliable — show as verified fact
//   - If not in Places data, don't infer from Claude
//     (too high-stakes to get wrong)
//
// DATA FRESHNESS:
//   - Google Places data cached for 30 days per place
//   - Re-fetch if user explicitly refreshes
//   - Community data: real-time, no cache
//   - Flag stale data (>90 days) with "last verified" date

// ============================================
// PRISMA SCHEMA ADDITIONS NEEDED (TODO):
// ============================================
//
// On SavedItem, add:
//   place_id          String?   // Google Places ID
//   verified_data     Json?     // Raw Google Places response
//   inferred_data     Json?     // Claude inference output
//   community_data    Json?     // Aggregated community tags
//   data_confidence   Float?    // 0-1 overall confidence
//   last_verified_at  DateTime?
//
// On RecommendedItem, add:
//   data_source       String    // "google_places" | "community" | "inferred"
//   age_min_verified  Boolean   // true if from Places or 3+ community
//   payment_verified  Boolean   // true if from Places API

// ============================================
// CURRENT STATE (Layer 1 only):
// ============================================
// og-extract.ts implements Layer 1 via two strategies:
//   1. Microlink API — handles JS-rendered sites
//      (Instagram, TikTok, Airbnb, Booking.com)
//   2. Direct fetch fallback — raw OG tag scrape
//      for simple static sites
//
// api/saves/route.ts orchestrates: detect platform →
// extract metadata → write SavedItem to DB.
//
// Layers 2–4 are not yet implemented.
// ============================================

export interface OgData {
  title?: string;
  description?: string;
  image?: string;
}

// Microlink handles JS-rendered sites (Airbnb, Booking.com, etc.)
async function extractViaMicrolink(url: string): Promise<OgData> {
  const endpoint = `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=false`;
  const res = await fetch(endpoint, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return {};

  const json = await res.json();
  if (json.status !== "success") return {};

  const { data } = json;
  return {
    title: data.title ?? undefined,
    description: data.description ?? undefined,
    image: data.image?.url ?? undefined,
  };
}

// Fallback: raw OG tag scrape for simple sites
async function extractViaFetch(url: string): Promise<OgData> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return {};

  const html = await res.text();

  const getOg = (property: string): string | undefined => {
    const a = html.match(
      new RegExp(
        `<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`,
        "i"
      )
    );
    if (a) return a[1];
    const b = html.match(
      new RegExp(
        `<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`,
        "i"
      )
    );
    return b?.[1];
  };

  const title =
    getOg("title") ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();

  return {
    title,
    description: getOg("description"),
    image: getOg("image"),
  };
}

export async function extractOgMetadata(url: string): Promise<OgData> {
  try {
    // Try microlink first — it handles JS-rendered sites
    const microlink = await extractViaMicrolink(url);
    if (microlink.title) return microlink;

    // Fall back to direct fetch for simple static sites
    return await extractViaFetch(url);
  } catch {
    return {};
  }
}
