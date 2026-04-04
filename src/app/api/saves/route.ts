function sanitizeThumbnailUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes("cdninstagram.com") || url.includes("fbcdn.net") || url.includes("scontent")) return null;
  return url;
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "igshid", "fbclid", "ref"].forEach(p => u.searchParams.delete(p));
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.trim().replace(/\/$/, "");
  }
}

// Extraction pipeline entry point.
// Full architecture documented in src/lib/og-extract.ts.
// Current state: Layer 1 (metadata) only.
// Layers 2 (Claude classification), 3 (Google Places),
// and 4 (community data) are not yet implemented.

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import he from "he";
import { z, ZodError } from "zod";
import { extractOgMetadata } from "@/lib/og-extract";
import type { SourceType } from "@prisma/client";
import { getVenueImage } from "@/lib/destination-images";
import { sendTransactional } from "@/lib/loops";
import { enrichSavedItem } from "@/lib/enrich-save";

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

    const stripRawUnicode = (str: string) => str.replace(/&#x[0-9a-fA-F]+;/gi, "").trim();
    const cleanText = (s: string | null | undefined): string | null =>
      s ? (stripRawUnicode(he.decode(s)) || null) : null;

    // If preview data was passed from the UI, use it directly (skip live OG fetch)
    let rawTitle = cleanText(title);
    let rawDescription = cleanText(description);
    let mediaThumbnailUrl = sanitizeImageUrl(thumbnailUrl);
    if (!title) {
      const meta = await extractOgMetadata(url);
      rawTitle = cleanText(meta.title);
      rawDescription = cleanText(meta.description);
      mediaThumbnailUrl = sanitizeImageUrl(meta.image);
    }

    // URL-based duplicate detection — checks normalized base URL first
    const baseUrl = normalizeUrl(url).split("?")[0];
    const existingByUrl = await db.savedItem.findFirst({
      where: {
        familyProfileId: user.familyProfile.id,
        sourceUrl: { contains: baseUrl, mode: "insensitive" },
      },
      select: { id: true, rawTitle: true, destinationCity: true },
    });
    if (existingByUrl) {
      return NextResponse.json({
        duplicate: true,
        existingId: existingByUrl.id,
        existingTitle: existingByUrl.rawTitle,
        existingCity: existingByUrl.destinationCity,
      }, { status: 200 });
    }

    // Title-based duplicate detection — fallback for same-name saves without URL
    if (rawTitle) {
      const existingByTitle = await db.savedItem.findFirst({
        where: {
          familyProfileId: user.familyProfile.id,
          rawTitle: { equals: rawTitle, mode: "insensitive" },
        },
        select: { id: true, rawTitle: true, destinationCity: true },
      });
      if (existingByTitle) {
        return NextResponse.json({
          duplicate: true,
          existingId: existingByTitle.id,
          existingTitle: existingByTitle.rawTitle,
          existingCity: existingByTitle.destinationCity,
        }, { status: 200 });
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
        placePhotoUrl: rawTitle ? (getVenueImage(rawTitle) ?? null) : null,
        categoryTags: tags ?? [],
        lat: lat ?? null,
        lng: lng ?? null,
        dayIndex: dayIndex ?? null,
        extractedCheckin: extractedCheckin ?? null,
        extractedCheckout: extractedCheckout ?? null,
        extractionStatus: "PENDING",
        status: tripId ? "TRIP_ASSIGNED" : "UNORGANIZED",
        userRating: userRating ?? null,
        userNote: userNote ?? null,
      },
    });

    // Fire enrichment directly — no Inngest
    if (!lat && !lng) {
      enrichSavedItem(savedItem.id)
        .catch((e) => console.error("[enrich] failed:", e));
    }

    // Loops: fire first-save if this is their first saved item
    try {
      const saveCount = await db.savedItem.count({ where: { familyProfileId: user.familyProfile.id } });
      if (saveCount === 1) {
        const clerkUser = await currentUser();
        const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? user.email;
        const firstName = clerkUser?.firstName ?? "";
        await sendTransactional(email, "cmn5lkkpe0dkm0ix9bdca2o54", {
          firstName,
          itemTitle: savedItem.rawTitle ?? "",
        });
      }
    } catch (e) {
      console.error("[loops] first-save trigger failed:", e);
    }

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
export const maxDuration = 60;

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
        const sanitizedPublic = saves.map(s => ({ ...s, mediaThumbnailUrl: sanitizeThumbnailUrl(s.mediaThumbnailUrl) }));
        console.log("[GET /api/saves] public trip", tripId, "returning", sanitizedPublic.length, "saves");
        return NextResponse.json({ saves: sanitizedPublic }, { headers: { "Cache-Control": "no-store" } });
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
        // Exclude flight-tagged saves — flights live in ItineraryItem, not SavedItem
        NOT: [
          // 1. Explicit flight tags (case-sensitive match)
          { categoryTags: { hasSome: ["flight", "airfare", "airline", "airflight", "flights", "Flight", "Airline", "Airfare"] } },
          // 2. Items with no coordinates whose rawTitle contains flight keywords
          //    (coordinate check avoids excluding places with "flight" in their name)
          { AND: [{ lat: null }, { rawTitle: { contains: "flight", mode: "insensitive" } }] },
          { AND: [{ lat: null }, { rawTitle: { contains: "airline", mode: "insensitive" } }] },
          { AND: [{ lat: null }, { rawTitle: { contains: "airfare", mode: "insensitive" } }] },
          // 3. Source URL matches Google Flights
          { sourceUrl: { contains: "/travel/flights", mode: "insensitive" } },
        ],
      },
      orderBy: { savedAt: "desc" },
      include: { trip: { select: { id: true, title: true } } },
    });

    console.log("[GET /api/saves] tripId param:", tripId ?? "none");
    const sanitized = saves.map(s => ({ ...s, mediaThumbnailUrl: sanitizeThumbnailUrl(s.mediaThumbnailUrl) }));
    console.log("[GET /api/saves] returning", sanitized.length, "saves for familyProfile", user.familyProfile.id);

    return NextResponse.json(
      { saves: sanitized },
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
