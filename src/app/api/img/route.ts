import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { persistRemoteImage } from "@/lib/imageStore";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// SSRF allowlist: hosts whose images we store or serve
const PROXY_HOSTS = new Set([
  "lh1.googleusercontent.com",
  "lh2.googleusercontent.com",
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "egnvlwgngyrkhhbxtlqa.supabase.co",
  "images.unsplash.com",
  "source.unsplash.com",
  "plus.unsplash.com",
  "upload.wikimedia.org",
  "picsum.photos",
  "maps.googleapis.com",
]);

const SUPABASE_HOST = "egnvlwgngyrkhhbxtlqa.supabase.co";
const GOOGLE_CDN = new Set([
  "lh1.googleusercontent.com",
  "lh2.googleusercontent.com",
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
]);

function isAllowedHost(host: string): boolean {
  if (PROXY_HOSTS.has(host)) return true;
  if (host.endsWith(".cdninstagram.com")) return true;
  if (host.endsWith(".supabase.co")) return true;
  return false;
}

// Branded SVG placeholder — navy/terracotta, DM Sans, Lucide-style icon
function makePlaceholder(cat?: string): Response {
  const icons: Record<string, string> = {
    food_and_drink:
      '<path d="M3 3v18"/><path d="M7 3v5a2 2 0 0 1-2 2H3"/><path d="M21 3v18"/><path d="M17 3v8"/><path d="M15 3v8"/><path d="M21 11h-6"/>',
    culture:
      '<polygon points="12 2 20 7 4 7"/><rect x="4" y="7" width="16" height="2"/><line x1="6" y1="9" x2="6" y2="22"/><line x1="10" y1="9" x2="10" y2="22"/><line x1="14" y1="9" x2="14" y2="22"/><line x1="18" y1="9" x2="18" y2="22"/><line x1="3" y1="22" x2="21" y2="22"/>',
    nature_and_outdoors:
      '<path d="m3 17 5-10 5 7 4-6 4 9H3z"/><path d="M12 17v4"/>',
    adventure:
      '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
    lodging:
      '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
    shopping:
      '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    sports_and_entertainment:
      '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>',
    kids_and_family:
      '<path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.1.5 2 .5s1.5-.2 2-.5"/><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>',
    nightlife:
      '<path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 10v12"/><path d="M5 4l7-2 7 2"/><path d="M5 4v6h14V4"/>',
    wellness:
      '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  };
  const labels: Record<string, string> = {
    food_and_drink: "Food", culture: "Culture", nature_and_outdoors: "Outdoors",
    adventure: "Adventure", lodging: "Stay", shopping: "Shopping",
    sports_and_entertainment: "Entertainment", kids_and_family: "Family",
    nightlife: "Nightlife", wellness: "Wellness",
  };
  const icon = (cat && icons[cat]) ?? '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>';
  const label = (cat && labels[cat]) ?? "Photo";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <rect width="400" height="300" fill="#1B3A5C"/>
  <g transform="translate(188,118)" stroke="#C4664A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    ${icon}
  </g>
  <text x="200" y="200" text-anchor="middle" fill="#C4664A" font-family="DM Sans, sans-serif" font-size="14" letter-spacing="0.8">${label}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

async function lazyHeal(googleUrl: string, flokUrl: string): Promise<void> {
  await Promise.allSettled([
    db.savedItem.updateMany({ where: { placePhotoUrl: googleUrl }, data: { placePhotoUrl: flokUrl } }),
    db.communitySpot.updateMany({ where: { photoUrl: googleUrl }, data: { photoUrl: flokUrl } }),
    db.manualActivity.updateMany({ where: { imageUrl: googleUrl }, data: { imageUrl: flokUrl } }),
  ]);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");
  const cat = searchParams.get("cat") ?? undefined;

  if (!rawUrl) return makePlaceholder(cat);

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return makePlaceholder(cat);
  }

  if (parsed.protocol !== "https:") return makePlaceholder(cat);

  const host = parsed.hostname;

  if (!isAllowedHost(host)) return makePlaceholder(cat);

  // Supabase Storage: already durable — stream with long cache
  if (host === SUPABASE_HOST || host.endsWith(".supabase.co")) {
    try {
      const res = await fetch(rawUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return makePlaceholder(cat);
      const body = res.body;
      if (!body) return makePlaceholder(cat);
      return new Response(body, {
        headers: {
          "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      return makePlaceholder(cat);
    }
  }

  // Google CDN (legacy rows): buffer → stream → async write-through + lazy heal
  if (GOOGLE_CDN.has(host)) {
    try {
      const imgRes = await fetch(rawUrl, { signal: AbortSignal.timeout(10000) });
      if (!imgRes.ok) return makePlaceholder(cat);

      const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
      const bytes = await imgRes.arrayBuffer();

      // Fire write-through + lazy heal without blocking the response
      persistRemoteImage(rawUrl)
        .then((flokUrl) => { if (flokUrl) lazyHeal(rawUrl, flokUrl).catch(() => {}); })
        .catch(() => {});

      return new Response(bytes, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch {
      return makePlaceholder(cat);
    }
  }

  // Other allowlisted hosts (Unsplash, Wikipedia, Instagram CDN, etc.): stream
  try {
    const imgRes = await fetch(rawUrl, { signal: AbortSignal.timeout(10000) });
    if (!imgRes.ok) return makePlaceholder(cat);
    const body = imgRes.body;
    if (!body) return makePlaceholder(cat);
    return new Response(body, {
      headers: {
        "Content-Type": imgRes.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return makePlaceholder(cat);
  }
}
