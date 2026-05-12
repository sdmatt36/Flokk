import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

function extractEmbedId(url: string): { platform: string; embedId: string } | null {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (ytMatch) return { platform: "youtube", embedId: ytMatch[1] };
  const ttMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  if (ttMatch) return { platform: "tiktok", embedId: ttMatch[1] };
  return null;
}

export async function GET() {
  // No auth required — returns only published:true videos

  const videos = await db.travelVideo.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      videoUrl: true,
      platform: true,
      embedId: true,
      thumbnailUrl: true,
      tags: true,
      destination: true,
      submittedBy: true,
    },
  });

  return NextResponse.json(videos);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, videoUrl, destination, tags } = body;
  if (!title || !videoUrl) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const embed = extractEmbedId(videoUrl);
  if (!embed) {
    return NextResponse.json({ error: "Unsupported video URL (YouTube or TikTok only)" }, { status: 400 });
  }

  const video = await db.travelVideo.create({
    data: {
      title,
      videoUrl,
      platform: embed.platform,
      embedId: embed.embedId,
      destination: destination ?? null,
      tags: tags ?? [],
      submittedBy: userId,
      published: false,
    },
  });

  return NextResponse.json(video, { status: 201 });
}
