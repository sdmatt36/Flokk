import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { detectPlatform } from "@/lib/extraction/detect-platform";
import { parsePlatform } from "@/lib/extraction/platform-parsers";
import { extractOgMetadata } from "@/lib/og-extract";

const PLATFORM_LABELS: Record<string, string> = {
  booking_com:   "Booking.com",
  airbnb:        "Airbnb",
  google_maps:   "Google Maps",
  getyourguide:  "GetYourGuide",
  viator:        "Viator",
  tripadvisor:   "TripAdvisor",
  expedia:       "Expedia",
  hotels_com:    "Hotels.com",
  instagram:     "Instagram",
  tiktok:        "TikTok",
  unknown:       "Web",
};

async function resolveShortUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    return res.url || url;
  } catch {
    return url;
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const rawUrl: string = body?.url;
    if (!rawUrl) return NextResponse.json({ error: "URL required" }, { status: 400 });

    // Detect platform and resolve short URLs
    let platform = detectPlatform(rawUrl);
    let url = rawUrl;

    if (platform === "google_maps_short") {
      url = await resolveShortUrl(rawUrl);
      platform = detectPlatform(url);
      if (platform === "google_maps_short") platform = "google_maps";
    }

    // Platform-specific parsing (URL-only, instant)
    const platformData = parsePlatform(platform, url);
    console.log("[extract] URL:", url, "| platform:", platform, "| platformData:", JSON.stringify(platformData));

    // OG/Microlink metadata fetch
    const og = await extractOgMetadata(url);
    console.log("[extract] OG result:", JSON.stringify(og));

    // Merge: OG wins for title/image quality; platform fills dates/category
    const result = {
      title: og.title ?? platformData.title ?? null,
      description: og.description ?? null,
      image: og.image ?? null,
      checkin: platformData.checkin ?? null,
      checkout: platformData.checkout ?? null,
      category: platformData.category ?? null,
      platform: (platform as string) === "google_maps_short" ? "google_maps" : platform,
      platformLabel: PLATFORM_LABELS[platform] ?? "Web",
      resolvedUrl: url !== rawUrl ? url : null,
    };

    console.log("[extract] Final result:", JSON.stringify(result));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/extract] error:", err);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
