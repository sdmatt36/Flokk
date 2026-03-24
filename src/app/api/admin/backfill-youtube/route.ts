import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { extractYouTubeId } from "@/app/api/content/submit/route";

const ADMIN_USER_IDS = [(process.env.ADMIN_CLERK_USER_ID ?? "").trim()];

async function isAdmin(userId: string): Promise<boolean> {
  if (ADMIN_USER_IDS.filter(Boolean).includes(userId.trim())) return true;
  const user = await db.user.findFirst({ where: { clerkId: userId } });
  return user?.email?.endsWith("@flokktravel.com") ?? false;
}

async function youtubeOEmbed(url: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const d = await res.json() as { title?: string };
    return d.title ?? null;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let fixedVideos = 0;
  let fixedArticles = 0;

  // ── TravelVideo: thumbnail null + YouTube URL ──────────────────────────────
  const videos = await db.travelVideo.findMany({
    where: {
      AND: [
        { OR: [{ videoUrl: { contains: "youtube.com" } }, { videoUrl: { contains: "youtu.be" } }] },
        { OR: [{ thumbnailUrl: null }, { title: { startsWith: "http" } }] },
      ],
    },
    select: { id: true, videoUrl: true, embedId: true, thumbnailUrl: true, title: true },
  });

  for (const v of videos) {
    const videoId = v.embedId || extractYouTubeId(v.videoUrl);
    if (!videoId) continue;

    const update: Record<string, string> = {};

    if (!v.thumbnailUrl) {
      update.thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
    if (!v.title || v.title.startsWith("http")) {
      const title = await youtubeOEmbed(v.videoUrl);
      if (title) update.title = title;
      await sleep(150);
    }

    if (Object.keys(update).length > 0) {
      await db.travelVideo.update({ where: { id: v.id }, data: update });
      fixedVideos++;
      console.log(`[backfill-youtube] fixed TravelVideo ${v.id}:`, update);
    }
  }

  // ── Article: sourceUrl contains youtube, thumbnailUrl null or title = URL ──
  const articles = await db.article.findMany({
    where: {
      OR: [
        { sourceUrl: { contains: "youtube.com" } },
        { sourceUrl: { contains: "youtu.be" } },
      ],
    },
    select: { id: true, sourceUrl: true, thumbnailUrl: true, title: true },
  });

  for (const a of articles) {
    if (!a.sourceUrl) continue;
    const videoId = extractYouTubeId(a.sourceUrl);
    if (!videoId) continue;

    const update: Record<string, string> = {};

    if (!a.thumbnailUrl) {
      update.thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
    if (!a.title || a.title.startsWith("http")) {
      const title = await youtubeOEmbed(a.sourceUrl);
      if (title) update.title = title;
      await sleep(150);
    }

    if (Object.keys(update).length > 0) {
      await db.article.update({ where: { id: a.id }, data: update });
      fixedArticles++;
      console.log(`[backfill-youtube] fixed Article ${a.id}:`, update);
    }
  }

  return NextResponse.json({
    success: true,
    fixedVideos,
    fixedArticles,
    message: `Fixed ${fixedVideos} videos and ${fixedArticles} articles`,
  });
}
