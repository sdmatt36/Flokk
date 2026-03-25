import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

function detectPlatform(url: string): string {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("vimeo.com")) return "vimeo";
  return "other";
}

function isVideoUrl(url: string): boolean {
  return (
    url.includes("youtube.com") ||
    url.includes("youtu.be") ||
    url.includes("tiktok.com") ||
    url.includes("instagram.com/reel") ||
    url.includes("vimeo.com")
  );
}

export function extractYouTubeId(url: string): string {
  const match =
    url.match(/[?&]v=([^&]+)/) ??
    url.match(/youtu\.be\/([^?/]+)/) ??
    url.match(/embed\/([^?]+)/);
  return match?.[1] ?? "";
}

async function youtubeOEmbed(url: string): Promise<{ title: string | null }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { title: null };
    const d = await res.json() as { title?: string };
    return { title: d.title ?? null };
  } catch {
    return { title: null };
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { url, title, description, destination, contentType, ageGroup, tags, ogTitle, ogImageUrl, ogDescription, publicationDate } = body;
  const resolvedTags: string[] = Array.isArray(tags) ? tags : [];
  const resolvedPublicationDate: Date | null = publicationDate ? new Date(publicationDate as string) : null;

  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  // Use client-provided OG data if available; otherwise fall back to server-side extraction
  let extractedTitle: string = ogTitle ?? title ?? "";
  let extractedThumb: string | null = ogImageUrl ?? null;
  const extractedDesc: string | null = description ?? ogDescription ?? null;

  // Auto-detect video from URL regardless of contentType submitted
  const resolvedIsVideo = isVideoUrl(url);
  const platform = resolvedIsVideo ? detectPlatform(url) : "other";
  const embedId = platform === "youtube" ? extractYouTubeId(url) : "";

  // For YouTube: construct reliable thumbnail and always use oEmbed for title.
  // OG title from YouTube is unreliable ("- YouTube" or "Video - YouTube") — oEmbed returns the clean title.
  if (platform === "youtube" && embedId) {
    if (!extractedThumb) {
      extractedThumb = `https://img.youtube.com/vi/${embedId}/maxresdefault.jpg`;
    }
    const { title: oembedTitle } = await youtubeOEmbed(url);
    if (oembedTitle) extractedTitle = oembedTitle;
  }

  // Generic fallback for non-YouTube URLs with no title
  if (!extractedTitle && !resolvedIsVideo) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(5000),
      });
      const html = await res.text();
      const ogTitleTag = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1];
      const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1];
      extractedTitle = ogTitleTag ?? url;
      if (!extractedThumb) extractedThumb = ogImage ?? null;
    } catch {
      // extraction is optional
    }
  }

  if (resolvedIsVideo) {
    const video = await db.travelVideo.create({
      data: {
        title: extractedTitle || url,
        videoUrl: url,
        platform,
        embedId,
        thumbnailUrl: extractedThumb,
        destination: destination ?? null,
        contentType: contentType ?? "creator",
        ageGroup: ageGroup ?? "all",
        tags: resolvedTags,
        status: "pending",
        submittedBy: userId,
        submittedAt: new Date(),
        publicationDate: resolvedPublicationDate,
      },
    });
    return NextResponse.json({ success: true, type: "video", id: video.id });
  } else {
    const slugBase = (extractedTitle || url)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 80);
    const slug = `${slugBase}-${Date.now()}`;

    const article = await db.article.create({
      data: {
        title: extractedTitle || url,
        slug,
        excerpt: extractedDesc ?? extractedTitle ?? url,
        content: "",
        thumbnailUrl: extractedThumb,
        sourceUrl: url,
        destination: destination ?? null,
        contentType: contentType ?? "community",
        ageGroup: ageGroup ?? "all",
        tags: resolvedTags,
        status: "pending",
        submittedBy: userId,
        submittedAt: new Date(),
        authorType: "community",
        publicationDate: resolvedPublicationDate,
      },
    });
    return NextResponse.json({ success: true, type: "article", id: article.id });
  }
}
