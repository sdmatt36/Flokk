import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

// GET /api/flokkers/search?query=...
// Autocomplete search for Flokk families by name. Requires auth.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const query = req.nextUrl.searchParams.get("query") ?? "";
  const trimmed = query.trim();

  if (trimmed.length < 2 || trimmed.length > 64) {
    return NextResponse.json({ results: [] });
  }

  const profiles = await db.familyProfile.findMany({
    where: {
      familyName: { contains: trimmed, mode: "insensitive" },
      id: { not: profileId },
    },
    select: {
      id: true,
      familyName: true,
      user: { select: { email: true } },
    },
    take: 10,
    orderBy: { familyName: "asc" },
  });

  const results = profiles
    .filter((p) => p.familyName !== null)
    .map((p) => ({
      id: p.id,
      familyName: p.familyName as string,
      primaryEmail: p.user?.email ?? null,
    }));

  return NextResponse.json({ results });
}
