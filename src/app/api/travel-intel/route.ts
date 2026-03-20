import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Maps UI category labels (lowercase) to DB tag keywords
const CATEGORY_MAP: Record<string, string[]> = {
  restaurants:    ["restaurant", "food", "dining", "cafe", "coffee", "breakfast", "lunch", "dinner", "eat", "ramen", "sushi", "pizza"],
  culture:        ["culture", "museum", "temple", "shrine", "church", "history", "art", "heritage", "historic", "gallery"],
  outdoors:       ["outdoor", "nature", "park", "hike", "beach", "trail", "garden", "scenic", "waterfall", "mountain"],
  "kids & family":["kids", "family", "children", "playground", "zoo", "theme park", "amusement", "aquarium"],
  shopping:       ["shopping", "market", "shop", "store", "boutique", "mall", "souvenir"],
  hotels:         ["hotel", "accommodation", "hostel", "resort", "ryokan", "stay", "lodging", "inn"],
};

type PlaceGroup = {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  lat: number | null;
  lng: number | null;
  categoryTags: string[];
  websiteUrl: string | null;
  affiliateUrl: string | null;
  saveCount: number;
  avgRating: number | null;
  tips: Array<{ id: string; category: string; content: string }>;
  tripLinks: Array<{ id: string; title: string }>;
  relevanceScore: number;
  _ratings: number[]; // internal, stripped before response
};

export async function GET(req: NextRequest) {
  const city     = req.nextUrl.searchParams.get("city")?.trim()     ?? "";
  const category = req.nextUrl.searchParams.get("category")?.toLowerCase().trim() ?? "";
  const offset   = Math.max(0, parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10));

  // Fetch saved items that belong to public completed trips
  const rawItems = await db.savedItem.findMany({
    where: {
      rawTitle: { not: null },
      trip: { status: "COMPLETED", privacy: "PUBLIC" },
    },
    include: {
      trip: {
        include: {
          tips: { select: { id: true, category: true, content: true } },
        },
      },
    },
    take: 2000,
  });

  // City filter (JS-side for flexible partial matching)
  const cityLower = city.toLowerCase();
  const cityFiltered = city
    ? rawItems.filter((item) => {
        const dc  = (item.destinationCity    ?? "").toLowerCase();
        const dco = (item.destinationCountry ?? "").toLowerCase();
        return (
          dc.includes(cityLower)  || dco.includes(cityLower) ||
          cityLower.includes(dc)  || cityLower.includes(dco)
        );
      })
    : rawItems;

  // Category filter
  const catKeywords = category && category !== "all" ? (CATEGORY_MAP[category] ?? [category]) : null;
  const catFiltered = catKeywords
    ? cityFiltered.filter((item) =>
        item.categoryTags.some((tag) =>
          catKeywords.some((kw) =>
            tag.toLowerCase().includes(kw) || kw.includes(tag.toLowerCase())
          )
        )
      )
    : cityFiltered;

  // Deduplication: group by normalised title + lat/lng bucket (≈100 m)
  const groups = new Map<string, PlaceGroup>();

  for (const item of catFiltered) {
    const titleNorm = (item.rawTitle ?? "").toLowerCase().trim();
    if (!titleNorm) continue;

    const latKey = item.lat != null ? Math.round(item.lat  * 1000) : "x";
    const lngKey = item.lng != null ? Math.round(item.lng  * 1000) : "x";
    const key    = `${titleNorm}|${latKey}|${lngKey}`;

    if (!groups.has(key)) {
      groups.set(key, {
        id:               item.id,
        title:            item.rawTitle!,
        description:      item.rawDescription,
        thumbnailUrl:     item.mediaThumbnailUrl,
        destinationCity:  item.destinationCity,
        destinationCountry: item.destinationCountry,
        lat:              item.lat,
        lng:              item.lng,
        categoryTags:     item.categoryTags,
        websiteUrl:       item.websiteUrl,
        affiliateUrl:     item.affiliateUrl,
        saveCount:        0,
        avgRating:        null,
        tips:             [],
        tripLinks:        [],
        relevanceScore:   item.relevanceScore ?? 0,
        _ratings:         [],
      });
    }

    const g = groups.get(key)!;
    g.saveCount++;

    // Use best thumbnail
    if (!g.thumbnailUrl && item.mediaThumbnailUrl) g.thumbnailUrl = item.mediaThumbnailUrl;

    // Track ratings
    if (item.userRating != null) g._ratings.push(item.userRating);

    // Trip link (deduplicated)
    if (item.trip && !g.tripLinks.some((t) => t.id === item.trip!.id)) {
      g.tripLinks.push({ id: item.trip.id, title: item.trip.title });
    }

    // Tips from this trip (deduplicated by id)
    if (item.trip?.tips) {
      for (const tip of item.trip.tips) {
        if (!g.tips.some((t) => t.id === tip.id)) {
          g.tips.push({ id: tip.id, category: tip.category, content: tip.content });
        }
      }
    }
  }

  // Compute average ratings & strip internal array
  const total = groups.size;
  const places = Array.from(groups.values())
    .sort((a, b) =>
      b.saveCount !== a.saveCount
        ? b.saveCount - a.saveCount
        : b.relevanceScore - a.relevanceScore
    )
    .slice(offset, offset + 50)
    .map(({ _ratings, ...rest }) => ({
      ...rest,
      avgRating:
        _ratings.length > 0
          ? Math.round((_ratings.reduce((s, r) => s + r, 0) / _ratings.length) * 10) / 10
          : null,
    }));

  return NextResponse.json({ places, total });
}
