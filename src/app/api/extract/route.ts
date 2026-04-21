import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import he from "he";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface OgResult {
  title: string | null;
  imageUrl: string | null;
  description: string | null;
}

async function fetchOgData(url: string): Promise<OgResult> {
  // Try Microlink first — handles JS-rendered sites (Airbnb, Booking.com, etc.)
  try {
    const endpoint = `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=false`;
    const res = await fetch(endpoint, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.status === "success" && json.data?.title) {
        const rawImage = json.data.image?.url ?? null;
        return {
          title: json.data.title ?? null,
          imageUrl: rawImage?.startsWith("http") && !rawImage.includes("{") ? rawImage : null,
          description: json.data.description ?? null,
        };
      }
    }
  } catch { /* fall through to direct fetch */ }

  // Direct HTML fetch fallback
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return { title: null, imageUrl: null, description: null };
    const html = await res.text();

    const getOg = (prop: string): string | null => {
      const a = html.match(new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']+)["']`, "i"))?.[1];
      if (a) return a;
      return html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${prop}["']`, "i"))?.[1] ?? null;
    };

    let title = getOg("title");
    if (!title) {
      const raw = html.match(/<title[^>]*>([^<]{3,})<\/title>/i)?.[1]?.trim();
      if (raw) title = raw.replace(/\s*[|\-–—]\s*.{0,80}$/, "").trim() || null;
    }

    const rawImage = getOg("image");
    const imageUrl = rawImage?.startsWith("http") && !rawImage.includes("{") ? rawImage : null;

    return { title: title ?? null, imageUrl: imageUrl ?? null, description: getOg("description") ?? null };
  } catch {
    return { title: null, imageUrl: null, description: null };
  }
}

function forceHttps(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http://") ? url.replace("http://", "https://") : url;
}

function sanitizeImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (!url.startsWith("http")) return null;
  if (url.includes("{") || url.includes("}")) return null;
  return url;
}

function cleanText(str: string | null | undefined): string | null {
  if (!str) return null;
  return he.decode(str).replace(/&#x[0-9a-fA-F]+;/gi, "").trim() || null;
}

function heuristicCategory(url: string): string {
  const u = url.toLowerCase();
  if (/hotel|inn|resort|lodge|hostel|suites?|ryokan|villa|metropolitan|granvia|hilton|marriott|hyatt|sheraton|westin|ritz/.test(u)) return "hotel";
  if (/restaurant|cafe|dining|food|eat|bistro|izakaya|ramen|sushi/.test(u)) return "restaurant";
  if (/museum|tour|ticket|guide|activity|experience|attraction/.test(u)) return "activity";
  return "other";
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const url: string = body?.url;
    if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

    // Step 1: Try HTML/OG extraction
    let { title, imageUrl, description } = await fetchOgData(url);
    console.log("[extract] OG result - title:", title, "| imageUrl:", imageUrl?.slice(0, 60) ?? "none");

    // Step 2: If no good title, use Claude to infer venue name from URL
    if (!title || title.startsWith("http")) {
      console.log("[extract] No OG title — calling Claude to infer from URL");
      try {
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          messages: [{
            role: "user",
            content: `Given this URL: ${url}

Infer the venue or place name and category. Return ONLY a JSON object:
{
  "title": "The venue or place name (human-readable, not a URL)",
  "category": "hotel|restaurant|activity|food|culture|shopping|transportation|other",
  "city": "city name or null",
  "country": "country name or null"
}

Rules:
- title must be a proper name like "Hotel Granvia Kyoto", not a URL
- For hotel sites: use the hotel name
- For restaurant sites: use the restaurant name
- Infer from domain name, path segments, and TLD
- Return only the JSON object, no markdown, no explanation`,
          }],
        });

        const text = (msg.content[0] as { type: string; text: string }).text.trim();
        const parsed = JSON.parse(text.match(/\{[\s\S]+\}/)?.[0] ?? "{}");
        console.log("[extract] Claude inferred:", JSON.stringify(parsed));

        if (parsed.title && !parsed.title.startsWith("http")) {
          return NextResponse.json({
            title: cleanText(parsed.title),
            imageUrl: sanitizeImageUrl(forceHttps(imageUrl)),
            description: cleanText(description),
            city: parsed.city ?? null,
            country: parsed.country ?? null,
            category: parsed.category ?? heuristicCategory(url),
          });
        }
      } catch (err) {
        console.error("[extract] Claude inference failed:", err);
      }
    }

    return NextResponse.json({
      title: cleanText(title),
      imageUrl: sanitizeImageUrl(forceHttps(imageUrl)),
      description: cleanText(description),
      city: null,
      country: null,
      category: heuristicCategory(url),
    });
  } catch (err) {
    console.error("[api/extract] error:", err);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
