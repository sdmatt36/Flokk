import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_USER_IDS = [
  (process.env.ADMIN_CLERK_USER_ID ?? "").trim(),
];

async function isAdmin(userId: string): Promise<boolean> {
  if (ADMIN_USER_IDS.filter(Boolean).includes(userId.trim())) return true;
  const user = await db.user.findFirst({ where: { clerkId: userId } });
  return user?.email?.endsWith("@flokktravel.com") ?? false;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { action, type, rejectionReason, tags, destination, ageGroup, title, url, contentType, description } = body;

  const updateData: Record<string, unknown> = {
    reviewedAt: new Date(),
    reviewedBy: userId,
  };

  if (action === "approve") updateData.status = "approved";
  if (action === "reject") { updateData.status = "rejected"; updateData.rejectionReason = rejectionReason ?? null; }
  if (action === "edit") {
    if (typeof title === "string") updateData.title = title;
    if (typeof url === "string") {
      if (type === "video") updateData.videoUrl = url;
      else updateData.sourceUrl = url;
    }
    if (typeof contentType === "string") updateData.contentType = contentType;
    if (typeof destination === "string") updateData.destination = destination;
    if (typeof ageGroup === "string") updateData.ageGroup = ageGroup;
    if (Array.isArray(tags)) updateData.tags = tags;
    if (typeof description === "string") {
      if (type === "video") updateData.description = description;
      else updateData.excerpt = description;
    }
    // Don't change status or reviewedAt for pure edits
    delete updateData.reviewedAt;
    delete updateData.reviewedBy;
  }

  if (tags && action !== "edit") updateData.tags = tags;
  if (destination && action !== "edit") updateData.destination = destination;
  if (ageGroup && action !== "edit") updateData.ageGroup = ageGroup;

  if (type === "video") {
    const updated = await db.travelVideo.update({ where: { id }, data: updateData });
    return NextResponse.json(updated);
  } else {
    const updated = await db.article.update({ where: { id }, data: updateData });
    return NextResponse.json(updated);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const type = req.nextUrl.searchParams.get("type") ?? "article";

  if (type === "video") {
    await db.travelVideo.delete({ where: { id } });
  } else {
    await db.article.delete({ where: { id } });
  }
  return NextResponse.json({ success: true });
}
