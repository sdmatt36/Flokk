import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) return NextResponse.json({ families: [] });

  const families = await db.familyProfile.findMany({
    where: {
      familyName: { contains: q, mode: "insensitive" },
      NOT: { user: { clerkId: userId } },
    },
    select: {
      id: true,
      familyName: true,
      homeCity: true,
    },
    take: 5,
  });

  return NextResponse.json({ families });
}
