import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET() {
  // No auth required — returns only published:true articles

  const articles = await db.article.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      authorType: true,
      authorId: true,
      tags: true,
      publishedAt: true,
    },
  });

  return NextResponse.json(articles);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, slug, excerpt, content, coverImage, tags } = body;
  if (!title || !slug || !excerpt || !content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const article = await db.article.create({
    data: {
      title,
      slug,
      excerpt,
      content,
      coverImage: coverImage ?? null,
      authorType: "community",
      authorId: userId,
      tags: tags ?? [],
      published: false,
    },
  });

  return NextResponse.json(article, { status: 201 });
}
