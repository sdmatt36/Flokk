import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { HAIKU } from "@/lib/ai-models";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { resolveGooglePhotoUrl } from "@/lib/google-places";
import { findNearestStopInsertionPoint } from "@/lib/tour-stop-insertion";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── helpers ───────────────────────────────────────────────────────────────────

async function resolvePlaceFull(name: string, address: string, destinationCity: string): Promise<{
  lat: number | null;
  lng: number | null;
  formattedAddress: string | null;
  imageUrl: string | null;
  websiteUrl: string | null;
  placeId: string | null;
  editorialSummary: string | null;
  types: string[];
  priceLevel: number | null;
  ticketRequired: string | null;
} | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  try {
    const query = [name, address, destinationCity].filter(Boolean).join(" ");
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=en&key=${key}`
    );
    const searchData = await searchRes.json() as {
      results?: Array<{ place_id: string; geometry?: { location?: { lat: number; lng: number } } }>;
    };
    const first = searchData.results?.[0];
    if (!first?.geometry?.location) return null;

    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${first.place_id}&fields=name,formatted_address,geometry,photos,website,types,price_level,editorial_summary&language=en&key=${key}`
    );
    const det = await detailsRes.json() as {
      result?: {
        formatted_address?: string;
        geometry?: { location?: { lat: number; lng: number } };
        photos?: Array<{ photo_reference: string }>;
        website?: string;
        types?: string[];
        price_level?: number;
        editorial_summary?: { overview?: string };
      };
    };

    const loc = det.result?.geometry?.location ?? first.geometry.location;
    const photoRef = det.result?.photos?.[0]?.photo_reference ?? null;
    let imageUrl: string | null = null;
    if (photoRef) {
      const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${key}`;
      imageUrl = await resolveGooglePhotoUrl(photoApiUrl);
    }

    const types = det.result?.types ?? [];
    const priceLevel = det.result?.price_level ?? null;
    const editorialSummary = det.result?.editorial_summary?.overview ?? null;

    // Derive ticket signal (mirrors generate/route.ts logic)
    const freeTypes = ["park", "natural_feature", "beach", "landmark", "neighborhood", "point_of_interest"];
    const ticketTypes = ["museum", "art_gallery", "amusement_park", "zoo", "aquarium", "tourist_attraction", "stadium", "movie_theater", "night_club"];
    let ticketRequired = "unknown";
    if (types.some(t => freeTypes.includes(t)) && !types.some(t => ticketTypes.includes(t))) {
      ticketRequired = "free";
    } else if (types.some(t => ticketTypes.includes(t))) {
      ticketRequired = "ticket-required";
    } else if (priceLevel != null && priceLevel > 0) {
      ticketRequired = "ticket-required";
    }

    const websiteUrl = det.result?.website
      ?? `https://www.google.com/maps/place/?q=place_id:${first.place_id}`;

    return {
      lat: loc.lat,
      lng: loc.lng,
      formattedAddress: det.result?.formatted_address ?? null,
      imageUrl,
      websiteUrl,
      placeId: first.place_id,
      editorialSummary,
      types,
      priceLevel,
      ticketRequired,
    };
  } catch {
    return null;
  }
}

async function getTravelTimeMin(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  transport: string
): Promise<number | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const profile = transport === "Walking" ? "walking" : "driving";
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?access_token=${token}&overview=false`
    );
    const data = await res.json() as { routes?: Array<{ duration: number }> };
    const secs = data.routes?.[0]?.duration;
    return secs != null ? Math.round(secs / 60) : null;
  } catch {
    return null;
  }
}

async function generateWhyText(
  stopName: string,
  editorialSummary: string | null,
  tourTitle: string,
  destinationCity: string,
  transport: string,
  inputVibe: string[]
): Promise<string> {
  const vibeStr = inputVibe.join(", ") || "general interest";
  const context = editorialSummary ? `Google says: "${editorialSummary}". ` : "";
  try {
    const msg = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 120,
      messages: [{
        role: "user",
        content: `Write 1-2 sentences (max 40 words) explaining why "${stopName}" in ${destinationCity} is a great addition to a ${transport.toLowerCase()} tour called "${tourTitle}" with a ${vibeStr} vibe. ${context}Be specific, warm, and family-friendly. No quotes, no prefix.`,
      }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    return text || `A great stop in ${destinationCity}.`;
  } catch {
    return `A great stop in ${destinationCity}.`;
  }
}

// ── POST — add a user-defined custom stop with full Places + AI enrichment ────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tour = await db.generatedTour.findUnique({
    where: { id },
    select: {
      familyProfileId: true,
      destinationCity: true,
      title: true,
      transport: true,
      inputVibe: true,
      stops: {
        where: { deletedAt: null },
        select: { id: true, orderIndex: true, lat: true, lng: true },
        orderBy: { orderIndex: "desc" },
      },
    },
  });
  if (!tour || tour.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as {
    name?: string;
    address?: string;
    durationMin?: number;
    notes?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Run Places enrichment and AI why-text in parallel — placement needs coords.
  const [places] = await Promise.all([
    resolvePlaceFull(body.name.trim(), body.address ?? "", tour.destinationCity),
  ]);

  // Generate why text once we have the editorial summary from Places
  const whyText = body.notes?.trim()
    || await generateWhyText(
      body.name.trim(),
      places?.editorialSummary ?? null,
      tour.title,
      tour.destinationCity,
      tour.transport,
      tour.inputVibe,
    );

  // ── Placement: insert in the route-logical slot, mirroring the AI add path ──
  // Reuse findNearestStopInsertionPoint (the helper addStopToTour uses): place the
  // new stop immediately after the geographically nearest existing stop and shift
  // the tail. Falls back to append when the place or all stops lack coordinates.
  const stopsAsc = [...tour.stops].sort((a, b) => a.orderIndex - b.orderIndex);
  const maxOrder = stopsAsc.length > 0 ? stopsAsc[stopsAsc.length - 1].orderIndex : -1;
  let insertAt: number;
  let prevStop: (typeof stopsAsc)[number] | null;
  let nextStop: (typeof stopsAsc)[number] | null;
  if (places && places.lat != null && places.lng != null && stopsAsc.some((s) => s.lat != null && s.lng != null)) {
    const { insertAfterStopId } = findNearestStopInsertionPoint(places.lat, places.lng, stopsAsc);
    const afterIdx = stopsAsc.findIndex((s) => s.id === insertAfterStopId);
    prevStop = stopsAsc[afterIdx];
    nextStop = stopsAsc[afterIdx + 1] ?? null;
    insertAt = prevStop.orderIndex + 1;
  } else {
    // No coordinates to place against — append (original behavior).
    insertAt = maxOrder + 1;
    prevStop = stopsAsc.length > 0 ? stopsAsc[stopsAsc.length - 1] : null;
    nextStop = null;
  }

  // ── Recompute only the two legs the insertion touches ──
  // prevStop -> new (stored on prevStop), and new -> nextStop (stored on the new
  // stop; 0 when the new stop ends up last, per the existing last-stop convention).
  let prevToNew: number | null = null;
  if (prevStop?.lat != null && prevStop?.lng != null && places?.lat != null && places?.lng != null) {
    prevToNew = await getTravelTimeMin(
      { lat: prevStop.lat, lng: prevStop.lng },
      { lat: places.lat, lng: places.lng },
      tour.transport
    );
  }
  let newToNext: number | null = null;
  if (nextStop?.lat != null && nextStop?.lng != null && places?.lat != null && places?.lng != null) {
    newToNext = await getTravelTimeMin(
      { lat: places.lat, lng: places.lng },
      { lat: nextStop.lat, lng: nextStop.lng },
      tour.transport
    );
  }
  const newStopTravelTime = newToNext ?? 0;

  // Shift the tail (orderIndex >= insertAt) to make room — only when inserting
  // before an existing stop. Append needs no shift.
  if (nextStop) {
    await db.tourStop.updateMany({
      where: { tourId: id, deletedAt: null, orderIndex: { gte: insertAt } },
      data: { orderIndex: { increment: 1 } },
    });
  }

  const stop = await db.tourStop.create({
    data: {
      id: crypto.randomUUID(),
      tourId: id,
      orderIndex: insertAt,
      name: body.name.trim(),
      address: places?.formattedAddress ?? body.address?.trim() ?? null,
      durationMin: body.durationMin ?? 30,
      travelTimeMin: newStopTravelTime,
      why: whyText,
      familyNote: null,
      lat: places?.lat ?? null,
      lng: places?.lng ?? null,
      imageUrl: places?.imageUrl ?? null,
      websiteUrl: places?.websiteUrl ?? null,
      placeId: places?.placeId ?? null,
      ticketRequired: places?.ticketRequired ?? null,
      placeTypes: places?.types ?? [],
    },
  });

  // Update the previous stop's outgoing leg to point at the new stop.
  if (prevToNew != null && prevStop) {
    await db.tourStop.update({
      where: { id: prevStop.id },
      data: { travelTimeMin: prevToNew },
    });
  }

  return NextResponse.json({
    id: stop.id,
    orderIndex: stop.orderIndex,
    name: stop.name,
    address: stop.address ?? "",
    lat: stop.lat ?? 0,
    lng: stop.lng ?? 0,
    duration: stop.durationMin ?? 30,
    travelTime: newStopTravelTime,
    why: stop.why ?? "",
    familyNote: "",
    imageUrl: stop.imageUrl ?? null,
    websiteUrl: stop.websiteUrl ?? null,
    ticketRequired: stop.ticketRequired ?? null,
    // Also return the previous stop's recomputed leg so the client can sync.
    prevStopTravelTime: prevToNew,
    prevStopId: prevStop?.id ?? null,
  });
}

// ── PATCH — persist a new stop order ─────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tour = await db.generatedTour.findUnique({
    where: { id },
    select: { familyProfileId: true },
  });
  if (!tour || tour.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as { order?: Array<{ id: string; orderIndex: number }> };
  if (!Array.isArray(body.order) || body.order.length === 0) {
    return NextResponse.json({ error: "order array is required" }, { status: 400 });
  }

  await db.$transaction(
    body.order.map(({ id: stopId, orderIndex }) =>
      db.tourStop.updateMany({
        where: { id: stopId, tourId: id },
        data: { orderIndex },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
