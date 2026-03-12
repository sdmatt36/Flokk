// Extraction pipeline entry point.
// Full architecture documented in src/lib/og-extract.ts.
// Current state: Layer 1 (metadata) only.
// Layers 2 (Claude classification), 3 (Google Places),
// and 4 (community data) are not yet implemented.

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z, ZodError } from "zod";
import { extractOgMetadata } from "@/lib/og-extract";
import type { SourceType } from "@prisma/client";

const SaveSchema = z.object({
  url: z.string().url(),
});

function detectSourceType(url: string): SourceType {
  if (/instagram\.com/.test(url)) return "INSTAGRAM";
  if (/tiktok\.com/.test(url)) return "TIKTOK";
  if (/maps\.google\.com|maps\.app\.goo\.gl|goo\.gl\/maps/.test(url))
    return "GOOGLE_MAPS";
  return "MANUAL";
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { url } = SaveSchema.parse(body);

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: { familyProfile: true },
    });

    if (!user?.familyProfile) {
      return NextResponse.json(
        { error: "Complete onboarding first" },
        { status: 400 }
      );
    }

    const sourceType = detectSourceType(url);
    const meta = await extractOgMetadata(url);

    const savedItem = await db.savedItem.create({
      data: {
        familyProfileId: user.familyProfile.id,
        sourceType,
        sourceUrl: url,
        rawTitle: meta.title ?? null,
        rawDescription: meta.description ?? null,
        mediaThumbnailUrl: meta.image ?? null,
        extractionStatus: meta.title ? "ENRICHED" : "PENDING",
      },
    });

    return NextResponse.json({ savedItem });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
    console.error("Save error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: { familyProfile: true },
    });

    if (!user?.familyProfile) {
      return NextResponse.json({ saves: [] });
    }

    const saves = await db.savedItem.findMany({
      where: {
        familyProfileId: user.familyProfile.id,
        ...(category && category !== "all"
          ? { categoryTags: { has: category } }
          : {}),
      },
      orderBy: { savedAt: "desc" },
    });

    return NextResponse.json({ saves });
  } catch (error) {
    console.error("Saves fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch saves" }, { status: 500 });
  }
}
