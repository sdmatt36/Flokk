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
  tripId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  dayIndex: z.number().int().min(0).optional(),
  extractedCheckin: z.string().optional(),
  extractedCheckout: z.string().optional(),
  userRating: z.number().int().min(1).max(5).optional().nullable(),
  userNote: z.string().optional().nullable(),
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
    const { url, tripId, title, description, thumbnailUrl, tags, lat, lng, dayIndex, extractedCheckin, extractedCheckout, userRating, userNote } = SaveSchema.parse(body);

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

    // Reject template placeholders and non-http image values
    function sanitizeImageUrl(img: string | undefined | null): string | null {
      if (!img) return null;
      if (!img.startsWith("http")) return null;
      if (img.includes("{") || img.includes("}")) return null;
      return img;
    }

    // If preview data was passed from the UI, use it directly (skip live OG fetch)
    let rawTitle = title ?? null;
    let rawDescription = description ?? null;
    let mediaThumbnailUrl = sanitizeImageUrl(thumbnailUrl);
    if (!title) {
      const meta = await extractOgMetadata(url);
      rawTitle = meta.title ?? null;
      rawDescription = meta.description ?? null;
      mediaThumbnailUrl = sanitizeImageUrl(meta.image);
    }

    // Duplicate detection — skip if title couldn't be resolved
    if (rawTitle) {
      const existing = await db.savedItem.findFirst({
        where: {
          familyProfileId: user.familyProfile.id,
          rawTitle: { equals: rawTitle, mode: "insensitive" },
        },
      });
      if (existing) {
        return NextResponse.json({
          success: false,
          duplicate: true,
          existingId: existing.id,
          message: "Already saved",
        });
      }
    }

    const savedItem = await db.savedItem.create({
      data: {
        familyProfileId: user.familyProfile.id,
        tripId: tripId ?? null,
        sourceType,
        sourceUrl: url,
        rawTitle,
        rawDescription,
        mediaThumbnailUrl,
        categoryTags: tags ?? [],
        lat: lat ?? null,
        lng: lng ?? null,
        dayIndex: dayIndex ?? null,
        extractedCheckin: extractedCheckin ?? null,
        extractedCheckout: extractedCheckout ?? null,
        extractionStatus: rawTitle ? "ENRICHED" : "PENDING",
        status: tripId ? "TRIP_ASSIGNED" : "UNORGANIZED",
        userRating: userRating ?? null,
        userNote: userNote ?? null,
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

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    // Debug: log auth identity for each request
    console.log("[GET /api/saves] clerkUserId:", userId ?? "null");

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const tripId = searchParams.get("tripId");
    const isPublicRequest = searchParams.get("public") === "true";

    // For public trip map requests, skip the familyProfileId filter when the trip is PUBLIC
    if (isPublicRequest && tripId) {
      const trip = await db.trip.findUnique({
        where: { id: tripId },
        select: { privacy: true },
      });
      if (trip?.privacy === "PUBLIC") {
        const saves = await db.savedItem.findMany({
          where: {
            tripId,
            ...(category && category !== "all" ? { categoryTags: { has: category } } : {}),
          },
          orderBy: { savedAt: "desc" },
          include: { trip: { select: { id: true, title: true } } },
        });
        console.log("[GET /api/saves] public trip", tripId, "returning", saves.length, "saves");
        return NextResponse.json({ saves }, { headers: { "Cache-Control": "no-store" } });
      }
    }

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: { familyProfile: true },
    });

    console.log("[GET /api/saves] familyProfileId:", user?.familyProfile?.id ?? "none");

    if (!user?.familyProfile) {
      console.log("[GET /api/saves] No familyProfile — returning empty");
      return NextResponse.json(
        { saves: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const saves = await db.savedItem.findMany({
      where: {
        familyProfileId: user.familyProfile.id,
        ...(category && category !== "all"
          ? { categoryTags: { has: category } }
          : {}),
        ...(tripId ? { tripId } : {}),
      },
      orderBy: { savedAt: "desc" },
      include: { trip: { select: { id: true, title: true } } },
    });

    console.log("[GET /api/saves] tripId param:", tripId ?? "none");
    console.log("[GET /api/saves] returning", saves.length, "saves for familyProfile", user.familyProfile.id);

    return NextResponse.json(
      { saves },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Saves fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch saves" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
