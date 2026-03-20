import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_USER_IDS = [process.env.ADMIN_CLERK_USER_ID ?? ""];

async function isAdmin(userId: string): Promise<boolean> {
  const envVal = process.env.ADMIN_CLERK_USER_ID ?? "(not set)";
  const filtered = ADMIN_USER_IDS.filter(Boolean);
  const includesResult = filtered.includes(userId);
  console.log("[admin/isAdmin] userId from auth():", JSON.stringify(userId));
  console.log("[admin/isAdmin] ADMIN_CLERK_USER_ID env:", JSON.stringify(envVal));
  console.log("[admin/isAdmin] filtered ADMIN_USER_IDS:", JSON.stringify(filtered));
  console.log("[admin/isAdmin] includes() result:", includesResult);
  if (includesResult) return true;
  const user = await db.user.findFirst({ where: { clerkId: userId } });
  console.log("[admin/isAdmin] email check:", JSON.stringify(user?.email ?? null));
  return user?.email?.endsWith("@flokktravel.com") ?? false;
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  console.log("[admin/GET] auth() userId:", JSON.stringify(userId ?? null));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const type = req.nextUrl.searchParams.get("type") ?? "all";

  const [articles, videos] = await Promise.all([
    db.article.findMany({
      where: {
        status,
        ...(type !== "all" ? { contentType: type } : {}),
      },
      orderBy: { submittedAt: "desc" },
      take: 50,
    }),
    db.travelVideo.findMany({
      where: {
        status,
        ...(type !== "all" ? { contentType: type } : {}),
      },
      orderBy: { submittedAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({ articles, videos });
}
