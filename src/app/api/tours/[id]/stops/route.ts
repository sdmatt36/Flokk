import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { HAIKU } from "@/lib/ai-models";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { resolveGooglePhotoUrl } from "@/lib/google-places";
import { findNearestStopInsertionPoint } from "@/lib/tour-stop-insertion";
import { getTravelTimeMin } from "@/lib/travel-time";
import { ticketFallbackFromSignals, ticketClassificationGuidance, isTicketSignal, type TicketSignal } from "@/lib/tour-ticket";

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

    // ticketRequired is no longer derived here — it now rides the AI why-call
    // (generateWhyAndTicket), with ticketFallbackFromSignals as the deterministic fallback.
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
    };
  } catch {
    return null;
  }
}


// Single Haiku tool call that returns BOTH the why-text and the ticket classification.
// The why is kept robust: a missing/failed ticket parse never blanks the why — it always
// falls back to the model's why or a safe default. ticketRequired is null when the model
// answers "unknown" or the call/parse fails, so the caller applies the deterministic
// fallback (ticketFallbackFromSignals).
async function generateWhyAndTicket(args: {
  stopName: string;
  types: string[];
  priceLevel: number | null;
  websiteUrl: string | null;
  editorialSummary: string | null;
  tourTitle: string;
  destinationCity: string;
  transport: string;
  inputVibe: string[];
}): Promise<{ why: string; ticketRequired: TicketSignal | null }> {
  const { stopName, types, priceLevel, websiteUrl, editorialSummary, tourTitle, destinationCity, transport, inputVibe } = args;
  const vibeStr = inputVibe.join(", ") || "general interest";
  const fallbackWhy = `A great stop in ${destinationCity}.`;
  const context = editorialSummary ? `Google says: "${editorialSummary}". ` : "";
  const signals = `Google types: [${types.join(", ") || "none"}]. Price level: ${priceLevel ?? "n/a"}. Website: ${websiteUrl ?? "none"}.`;
  try {
    const msg = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 400,
      tools: [{
        name: "emit_stop_enrichment",
        description: "Emit the why-text and the ticketing classification for this tour stop.",
        input_schema: {
          type: "object",
          properties: {
            why: { type: "string", description: `1-2 sentences (max 40 words) explaining why "${stopName}" in ${destinationCity} is a great addition to a ${transport.toLowerCase()} tour called "${tourTitle}" with a ${vibeStr} vibe. Specific, warm, and family-friendly. No quotes.` },
            ticketRequired: { type: "string", enum: ["free", "ticket-required", "advance-booking-recommended", "unknown"], description: ticketClassificationGuidance() },
          },
          required: ["why", "ticketRequired"],
        },
      }],
      tool_choice: { type: "tool", name: "emit_stop_enrichment" },
      messages: [{
        role: "user",
        content: `Stop: "${stopName}" in ${destinationCity}. ${context}${signals}`,
      }],
    });

    let input: { why?: unknown; ticketRequired?: unknown } = {};
    for (const block of msg.content) {
      if (block.type === "tool_use") {
        input = block.input as { why?: unknown; ticketRequired?: unknown };
        break;
      }
    }
    const why = typeof input.why === "string" && input.why.trim() ? input.why.trim() : fallbackWhy;
    const ticketRequired = isTicketSignal(input.ticketRequired) && input.ticketRequired !== "unknown"
      ? input.ticketRequired
      : null;
    return { why, ticketRequired };
  } catch {
    return { why: fallbackWhy, ticketRequired: null };
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

  // Resolve the place first — both the why/ticket call and placement need its signals.
  const places = await resolvePlaceFull(body.name.trim(), body.address ?? "", tour.destinationCity);

  // One AI call returns the why-text AND the ticket classification, fed the place signals.
  const enrichment = await generateWhyAndTicket({
    stopName: body.name.trim(),
    types: places?.types ?? [],
    priceLevel: places?.priceLevel ?? null,
    websiteUrl: places?.websiteUrl ?? null,
    editorialSummary: places?.editorialSummary ?? null,
    tourTitle: tour.title,
    destinationCity: tour.destinationCity,
    transport: tour.transport,
    inputVibe: tour.inputVibe,
  });
  // User notes win for the why; otherwise the model's why. ticketRequired comes from the
  // model, falling back to the shared deterministic helper only when the model is unsure.
  const whyText = body.notes?.trim() || enrichment.why;
  const ticketRequired = enrichment.ticketRequired
    ?? ticketFallbackFromSignals(places?.types ?? [], places?.priceLevel, places?.editorialSummary);

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
      ticketRequired,
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
