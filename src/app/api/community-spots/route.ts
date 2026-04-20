import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAdmin(userId);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const needsUrlReviewParam = req.nextUrl.searchParams.get("needsUrlReview");
  const where: { needsUrlReview?: boolean; category?: { notIn: string[] } } = {
    category: { notIn: ["train", "flight", "airline", "transport", "transit"] },
  };
  if (needsUrlReviewParam === "true") where.needsUrlReview = true;

  const spots = await db.communitySpot.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      city: true,
      country: true,
      category: true,
      photoUrl: true,
      websiteUrl: true,
      averageRating: true,
      ratingCount: true,
      updatedAt: true,
      needsUrlReview: true,
    },
  });

  return NextResponse.json({ spots });
}
