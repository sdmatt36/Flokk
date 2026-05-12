import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { extractYouTubeId } from "@/app/api/content/submit/route";

export const dynamic = "force-dynamic";

function ytThumb(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

function isYouTubeUrl(url: string) {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function isUrlLike(s: string) {
  return s.startsWith("http") || s.startsWith("youtu");
}

async function fetchOEmbedTitle(videoUrl: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const d = await res.json() as { title?: string };
    return d.title ?? null;
  } catch {
    return null;
  }
}

/** Return a display-safe title — never a raw URL */
function safeTitle(title: string | null | undefined, description: string | null | undefined, url: string | null | undefined): string {
  if (title && !isUrlLike(title)) return title;
  if (description && description.trim() && !isUrlLike(description)) {
    return description.slice(0, 80).replace(/\s+\S*$/, "").trim() || description.slice(0, 60);
  }
  if (url) {
    try {
      return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
    } catch { /* fall through */ }
  }
  return title ?? "Untitled";
}

export async function GET(req: NextRequest) {
  await auth(); // optional — available for future per-user personalisation

  const city = req.nextUrl.searchParams.get("city") ?? "";

  const where = {
    status: "approved",
    ...(city ? { destination: { contains: city, mode: "insensitive" as const } } : {}),
  };

  const [articles, videos] = await Promise.all([
    db.article.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        thumbnailUrl: true,
        coverImage: true,
        excerpt: true,
        destination: true,
        ageGroup: true,
        contentType: true,
        authorType: true,
        tags: true,
        submittedAt: true,
        publicationDate: true,
      },
    }),
    db.travelVideo.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        title: true,
        videoUrl: true,
        embedId: true,
        thumbnailUrl: true,
        description: true,
        destination: true,
        ageGroup: true,
        contentType: true,
        submittedBy: true,
        tags: true,
        submittedAt: true,
        publicationDate: true,
      },
    }),
  ]);

  // Collect records needing oEmbed title fix, fetch all in parallel
  type OEmbedJob = { type: "video" | "article"; id: string; url: string };
  const jobs: OEmbedJob[] = [];

  for (const a of articles) {
    const sourceUrl = a.sourceUrl ?? "";
    if (sourceUrl && isYouTubeUrl(sourceUrl) && (!a.title || isUrlLike(a.title))) {
      jobs.push({ type: "article", id: a.id, url: sourceUrl });
    }
  }
  for (const v of videos) {
    if (isYouTubeUrl(v.videoUrl) && (!v.title || isUrlLike(v.title))) {
      jobs.push({ type: "video", id: v.id, url: v.videoUrl });
    }
  }

  // Fetch all oEmbed titles in parallel, persist to DB, build title map
  const titleOverrides = new Map<string, string>();
  if (jobs.length > 0) {
    await Promise.all(jobs.map(async (job) => {
      const title = await fetchOEmbedTitle(job.url);
      if (title) {
        titleOverrides.set(job.id, title);
        // Persist asynchronously — don't await, response is already correct
        if (job.type === "video") {
          db.travelVideo.update({ where: { id: job.id }, data: { title } }).catch(() => {});
        } else {
          db.article.update({ where: { id: job.id }, data: { title } }).catch(() => {});
        }
      }
    }));
  }

  const items = [
    ...articles.map((a) => {
      let { thumbnailUrl } = a;
      const sourceUrl = a.sourceUrl ?? null;
      const title = titleOverrides.get(a.id) ?? a.title;

      if (sourceUrl && isYouTubeUrl(sourceUrl)) {
        const videoId = extractYouTubeId(sourceUrl);
        if (videoId && !thumbnailUrl) {
          thumbnailUrl = ytThumb(videoId);
          db.article.update({ where: { id: a.id }, data: { thumbnailUrl } }).catch(() => {});
        }
      }

      return {
        id: `article-${a.id}`,
        kind: "article" as const,
        title: safeTitle(title, a.excerpt, sourceUrl),
        url: sourceUrl,
        thumbnailUrl: thumbnailUrl ?? a.coverImage ?? null,
        description: a.excerpt ?? null,
        destination: a.destination ?? null,
        ageGroup: a.ageGroup ?? null,
        contentType: a.contentType ?? "Article",
        isFlokk: a.authorType === "flokk",
        tags: a.tags ?? [],
        submittedAt: a.submittedAt.toISOString(),
        publicationDate: a.publicationDate?.toISOString() ?? null,
      };
    }),
    ...videos.map((v) => {
      let { thumbnailUrl } = v;
      const title = titleOverrides.get(v.id) ?? v.title;

      if (isYouTubeUrl(v.videoUrl)) {
        const videoId = v.embedId || extractYouTubeId(v.videoUrl);
        if (videoId && !thumbnailUrl) {
          thumbnailUrl = ytThumb(videoId);
          db.travelVideo.update({ where: { id: v.id }, data: { thumbnailUrl } }).catch(() => {});
        }
      }

      return {
        id: `video-${v.id}`,
        kind: "video" as const,
        title: safeTitle(title, v.description, v.videoUrl),
        url: v.videoUrl ?? null,
        thumbnailUrl: thumbnailUrl ?? null,
        description: v.description ?? null,
        destination: v.destination ?? null,
        ageGroup: v.ageGroup ?? null,
        contentType: v.contentType ?? "Video",
        isFlokk: !v.submittedBy,
        tags: v.tags ?? [],
        submittedAt: v.submittedAt.toISOString(),
        publicationDate: v.publicationDate?.toISOString() ?? null,
      };
    }),
  ].sort((a, b) => a.title.localeCompare(b.title));

  return NextResponse.json(items);
}
