function sanitizeThumbnailUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/[?&]key=AIza/i.test(url)) return null; // reject key-bearing Google API URLs
  return url;
}

function isMapsUrl(url: string): boolean {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com|(www\.)?google\.com\/maps)/i.test(url);
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

import { auth } from "@clerk/nextjs/server";
import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import he from "he";
import { z, ZodError } from "zod";
import { extractOgMetadata } from "@/lib/og-extract";
import { inferPlatformFromUrl } from "@/lib/saved-item-types";
import { getVenueImage } from "@/lib/destination-images";
import { enrichSavedItem, SOCIAL_PLATFORMS, isAggregatorUrl } from "@/lib/enrich-save";
import { enrichWithPlaces } from "@/lib/enrich-with-places";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";
import { normalizeCategorySlug } from "@/lib/categories";
import { findMatchingTrip } from "@/lib/find-matching-trip";
import { writeThroughCommunitySpot } from "@/lib/community-write-through";
import { inferLodgingType } from "@/lib/infer-lodging-type";
import { toDurableImageUrl } from "@/lib/imageStore";

const ManualSaveSchema = z.object({
  sourceMethod: z.literal("URL_PASTE"),
  title: z.string().min(1),
  category: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  tripId: z.string().optional().nullable(),
  placePhotoUrl: z.string().optional().nullable(),
  communitySpotId: z.string().optional().nullable(),
});

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
  notes: z.string().optional().nullable(),
  destinationCity: z.string().optional().nullable(),
});


export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    // Manual activity save — no URL required
    if (body.sourceMethod === "URL_PASTE") {
      const parsed = ManualSaveSchema.parse(body);
      const profileId = await resolveProfileId(userId);
      if (!profileId) return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
      const saveProfile = await db.familyProfile.findUnique({ where: { id: profileId } });
      if (!saveProfile) return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
      const savedItem = await db.savedItem.create({
        data: {
          familyProfileId: saveProfile.id,
          sourceMethod: "URL_PASTE",
          sourcePlatform: inferPlatformFromUrl(parsed.website ?? null),
          rawTitle: parsed.title,
          destinationCity: parsed.city?.trim() || null,
          categoryTags: normalizeAndDedupeCategoryTags(parsed.category ? [normalizeCategorySlug(parsed.category) ?? parsed.category] : []),
          notes: parsed.notes?.trim() || null,
          address: parsed.address?.trim() || null,
          websiteUrl: parsed.website?.trim() || null,
          placePhotoUrl: await toDurableImageUrl(parsed.placePhotoUrl ?? null),
          tripId: parsed.tripId ?? null,
          communitySpotId: parsed.communitySpotId ?? null,
          lodgingType: inferLodgingType({ url: parsed.website, name: parsed.title }) ?? null,
          extractionStatus: "PENDING",
          status: parsed.tripId ? "TRIP_ASSIGNED" : "UNORGANIZED",
        },
      });

      // Always run Places resolution to populate googlePlaceId, lat, lng — not just photo.
      const enriched = await enrichWithPlaces(parsed.title, parsed.city?.trim() ?? "");
      const manualEnrichedPhotoUrl = enriched.imageUrl && (!savedItem.placePhotoUrl || savedItem.placePhotoUrl === "") ? enriched.imageUrl : null;
      const manualEnrichedWebsite = enriched.website && !savedItem.websiteUrl && !isMapsUrl(enriched.website) ? enriched.website : null;
      await db.savedItem.update({
        where: { id: savedItem.id },
        data: {
          extractionStatus: "ENRICHED",
          ...(enriched.placeId ? { googlePlaceId: enriched.placeId } : {}),
          ...(enriched.lat !== null && enriched.lng !== null ? { lat: enriched.lat, lng: enriched.lng } : {}),
          ...(manualEnrichedPhotoUrl ? { placePhotoUrl: manualEnrichedPhotoUrl } : {}),
          ...(manualEnrichedWebsite ? { websiteUrl: manualEnrichedWebsite } : {}),
          ...(enriched.formattedAddress ? { address: enriched.formattedAddress } : {}),
          ...(enriched.country ? { destinationCountry: enriched.country } : {}),
          ...(!enriched.placeId ? { needsPlaceConfirmation: true } : {}),
        },
      });

      // Auto-assign to matching trip only when no explicit tripId was supplied
      let matchedTrip: { id: string; title: string; destinationCity: string | null } | null = null;
      if (!parsed.tripId) {
        try {
          matchedTrip = await findMatchingTrip(saveProfile.id, parsed.city ?? null, parsed.country ?? null);
          if (matchedTrip) {
            await db.savedItem.update({
              where: { id: savedItem.id },
              data: { tripId: matchedTrip.id, status: "TRIP_ASSIGNED" },
            });
          }
        } catch (e) {
          console.error("[saves] manual trip match failed:", e);
        }
      }
      return NextResponse.json({
        savedItem: {
          ...savedItem,
          placePhotoUrl: manualEnrichedPhotoUrl ?? savedItem.placePhotoUrl,
          websiteUrl: manualEnrichedWebsite ?? savedItem.websiteUrl,
          tripId: parsed.tripId ?? matchedTrip?.id ?? null,
        },
        matchedTrip: matchedTrip ?? null,
      });
    }

    const { url, tripId, title, description, thumbnailUrl, tags, lat, lng, dayIndex, extractedCheckin, extractedCheckout, userRating, notes, destinationCity } = SaveSchema.parse(body);

    const profileId = await resolveProfileId(userId);
    if (!profileId) return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    const saveProfile = await db.familyProfile.findUnique({ where: { id: profileId } });
    if (!saveProfile) return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });

    const sourcePlatform = inferPlatformFromUrl(url);

    // Reject template placeholders, non-http values, and key-bearing Google API URLs
    function sanitizeImageUrl(img: string | undefined | null): string | null {
      if (!img) return null;
      if (!img.startsWith("http")) return null;
      if (img.includes("{") || img.includes("}")) return null;
      if (/[?&]key=AIza/i.test(img)) return null; // staticmap, place/photo, streetview, etc.
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
        familyProfileId: saveProfile.id,
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
          familyProfileId: saveProfile.id,
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

    const savedItem = await db.$transaction(async (tx) => {
      const created = await tx.savedItem.create({
        data: {
          familyProfileId: saveProfile.id,
          tripId: tripId ?? null,
          sourceMethod: "URL_PASTE",
          sourcePlatform,
          sourceUrl: url,
          rawTitle,
          rawDescription,
          mediaThumbnailUrl,
          destinationCity: destinationCity ?? null,
          placePhotoUrl: rawTitle ? (getVenueImage(rawTitle) ?? null) : null,
          categoryTags: normalizeAndDedupeCategoryTags((tags ?? []).map(t => normalizeCategorySlug(t) ?? t)),
          lat: lat ?? null,
          lng: lng ?? null,
          dayIndex: dayIndex ?? null,
          extractedCheckin: extractedCheckin ?? null,
          extractedCheckout: extractedCheckout ?? null,
          extractionStatus: "PENDING",
          status: tripId ? "TRIP_ASSIGNED" : "UNORGANIZED",
          userRating: userRating ?? null,
          notes: notes ?? null,
          lodgingType: inferLodgingType({ url }) ?? null,
        },
      });

      if ((created.userRating != null || (created.notes && created.notes.trim() !== "")) && created.destinationCity) {
        await writeThroughCommunitySpot(tx, {
          name: created.rawTitle ?? "",
          city: created.destinationCity,
          country: created.destinationCountry ?? null,
          lat: created.lat ?? null,
          lng: created.lng ?? null,
          photoUrl: created.placePhotoUrl ?? created.mediaThumbnailUrl ?? null,
          websiteUrl: created.websiteUrl ?? null,
          description: created.notes ?? null,
          category: created.categoryTags?.[0] ?? null,
          googlePlaceId: null,
          authorProfileId: created.familyProfileId,
          familyProfileId: created.familyProfileId,
          rating: created.userRating ?? null,
          note: created.notes ?? null,
        });
      }

      // PlaceRating write-through — fires when userRating is set at create time.
      if (created.userRating != null) {
        await tx.placeRating.create({
          data: {
            familyProfileId: created.familyProfileId,
            tripId: created.tripId ?? null,
            savedItemId: created.id,
            placeName: created.rawTitle ?? "Unknown",
            placeType: (created.categoryTags && created.categoryTags[0]) ? created.categoryTags[0] : "other",
            destinationCity: created.destinationCity ?? null,
            lat: created.lat ?? null,
            lng: created.lng ?? null,
            rating: created.userRating,
            notes: created.notes ?? null,
            wouldReturn: created.userRating >= 4,
          },
        });
      }

      return created;
    }, { timeout: 10000 });

    // Enrich with Google Places photo at save time (synchronous — result in same response)
    let urlEnrichedPhotoUrl: string | null = null;
    let urlEnrichedWebsite: string | null = null;
    // Skip the Places pre-pass for social saves: their scraped title is the account/
    // caption ("Sonya Chang | Expat life in Taipei…"), not a place name, so textsearch
    // invents a coincidental pin. The real place is resolved later by enrichSavedItem's
    // caption extraction.
    const isSocialSave = (SOCIAL_PLATFORMS as readonly string[]).includes(sourcePlatform);
    // Also skip aggregator/OTA URLs (airbnb/booking/etc.): their scraped OG title is generic
    // ("Airbnb: Vacation Rentals…"), so textsearch invents a coincidental pin. Leaving lat null
    // here lets enrichSavedItem's aggregator guard flag needsPlaceConfirmation instead.
    const skipPrePass = isSocialSave || isAggregatorUrl(url);
    if (rawTitle && !skipPrePass && (!savedItem.placePhotoUrl || !savedItem.googlePlaceId)) {
      const enriched = await enrichWithPlaces(rawTitle, destinationCity ?? "");
      const placesUpdate: { placePhotoUrl?: string; websiteUrl?: string; destinationCountry?: string; googlePlaceId?: string; address?: string; lat?: number; lng?: number } = {};
      if (enriched.imageUrl && !savedItem.placePhotoUrl) { placesUpdate.placePhotoUrl = enriched.imageUrl; urlEnrichedPhotoUrl = enriched.imageUrl; }
      if (enriched.website && !savedItem.websiteUrl && !isMapsUrl(enriched.website)) { placesUpdate.websiteUrl = enriched.website; urlEnrichedWebsite = enriched.website; }
      if (enriched.country && !savedItem.destinationCountry) { placesUpdate.destinationCountry = enriched.country; }
      if (enriched.placeId) { placesUpdate.googlePlaceId = enriched.placeId; }
      if (enriched.formattedAddress) { placesUpdate.address = enriched.formattedAddress; }
      if (enriched.lat !== null && !savedItem.lat) { placesUpdate.lat = enriched.lat; }
      if (enriched.lng !== null && !savedItem.lng) { placesUpdate.lng = enriched.lng; }
      if (Object.keys(placesUpdate).length > 0) {
        await db.savedItem.update({ where: { id: savedItem.id }, data: placesUpdate });
      }
    }

    // Fire enrichment after response is sent; after() keeps the function alive until the promise resolves.
    if (!lat && !lng) {
      after(() =>
        enrichSavedItem(savedItem.id).catch((e) => console.error("[enrich] failed:", e))
      );
    }

    // Auto-assign to matching trip: exact city match first, then country fallback (only when not already assigned)
    let matchedTrip: { id: string; title: string; destinationCity: string | null } | null = null;
    if (!tripId) {
      try {
        matchedTrip = await findMatchingTrip(saveProfile.id, savedItem.destinationCity ?? null, null);
        if (matchedTrip) {
          await db.savedItem.update({
            where: { id: savedItem.id },
            data: { tripId: matchedTrip.id, status: "TRIP_ASSIGNED" },
          });
        }
      } catch (e) {
        console.error("[saves] url trip match failed:", e);
      }
    }

    return NextResponse.json({
      savedItem: {
        ...savedItem,
        placePhotoUrl: urlEnrichedPhotoUrl ?? savedItem.placePhotoUrl,
        websiteUrl: urlEnrichedWebsite ?? savedItem.websiteUrl,
        tripId: matchedTrip?.id ?? savedItem.tripId,
      },
      matchedTrip: matchedTrip ?? null,
    });
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
            deletedAt: null,
            ...(category && category !== "all" ? { categoryTags: { has: category } } : {}),
          },
          orderBy: { savedAt: "desc" },
          include: {
            trip: { select: { id: true, title: true } },
            communitySpot: { select: { photoUrl: true } },
          },
        });
        const sanitizedPublic = saves.map(s => ({
          ...s,
          mediaThumbnailUrl: sanitizeThumbnailUrl(s.mediaThumbnailUrl),
          placePhotoUrl: s.placePhotoUrl || s.communitySpot?.photoUrl || null,
        }));
        console.log("[GET /api/saves] public trip", tripId, "returning", sanitizedPublic.length, "saves");
        return NextResponse.json({ saves: sanitizedPublic }, { headers: { "Cache-Control": "no-store" } });
      }
    }

    const getProfileId = await resolveProfileId(userId);

    console.log("[GET /api/saves] familyProfileId:", getProfileId ?? "none");

    if (!getProfileId) {
      console.log("[GET /api/saves] No familyProfile — returning empty");
      return NextResponse.json(
        { saves: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const saves = await db.savedItem.findMany({
      where: {
        familyProfileId: getProfileId,
        deletedAt: null,
        ...(category && category !== "all"
          ? { categoryTags: { has: category } }
          : {}),
        ...(tripId ? { tripId } : {}),
        // Exclude flight-tagged saves — flights live in ItineraryItem, not SavedItem
        NOT: [
          // 1. Explicit flight tags — guard with isEmpty:false so NULL categoryTags don't propagate
          //    NULL categoryTags: hasSome evaluates to NULL → NOT NULL = NULL → row silently dropped
          //    isEmpty:false short-circuits to false for empty/null arrays, preventing NULL propagation
          { AND: [{ categoryTags: { isEmpty: false } }, { categoryTags: { hasSome: ["flight", "airfare", "airline", "airflight", "flights", "Flight", "Airline", "Airfare"] } }] },
          // 2. Items with no coordinates whose rawTitle contains flight keywords
          //    (coordinate check avoids excluding places with "flight" in their name)
          { AND: [{ lat: null }, { rawTitle: { contains: "flight", mode: "insensitive" } }] },
          { AND: [{ lat: null }, { rawTitle: { contains: "airline", mode: "insensitive" } }] },
          { AND: [{ lat: null }, { rawTitle: { contains: "airfare", mode: "insensitive" } }] },
          // 3. Source URL matches Google Flights (guard against null — NULL ILIKE propagates and excludes rows)
          { AND: [{ sourceUrl: { not: null } }, { sourceUrl: { contains: "/travel/flights", mode: "insensitive" } }] },
        ],
      },
      orderBy: { savedAt: "desc" },
      include: {
        trip: { select: { id: true, title: true, status: true, endDate: true } },
        communitySpot: { select: { photoUrl: true } },
        tripDocuments: { select: { type: true } },
      },
    });

    console.log("[GET /api/saves] tripId param:", tripId ?? "none");
    const sanitized = saves.map(s => {
      const { tripDocuments, communitySpot, ...rest } = s;
      const hasBooking = tripDocuments.some(d => d.type === "booking");
      const hasItineraryLink = s.dayIndex != null || tripDocuments.length > 0;
      return {
        ...rest,
        mediaThumbnailUrl: sanitizeThumbnailUrl(s.mediaThumbnailUrl),
        placePhotoUrl: s.placePhotoUrl || communitySpot?.photoUrl || null,
        hasBooking,
        hasItineraryLink,
        tripStatus: s.trip?.status ?? null,
        tripEndDate: s.trip?.endDate ? s.trip.endDate.toISOString() : null,
      };
    });
    console.log("[GET /api/saves] returning", sanitized.length, "saves for familyProfile", getProfileId);

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
