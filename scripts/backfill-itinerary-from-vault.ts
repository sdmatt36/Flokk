/**
 * backfill-itinerary-from-vault.ts
 *
 * Creates missing ItineraryItems from existing vault TripDocument records
 * for ALL trips and ALL users. Covers hotels and trains (and any flights)
 * that were imported before the webhook started creating ItineraryItems.
 *
 * Run: npx ts-node scripts/backfill-itinerary-from-vault.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// ── Helpers (mirrors email-inbound webhook) ────────────────────────────────

async function geocodePlace(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!key) { console.warn("[backfill] no Google Maps API key — skipping geocoding"); return null; }
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as {
      results?: Array<{ geometry: { location: { lat: number; lng: number } } }>;
    };
    const first = data.results?.[0];
    if (!first) return null;
    return { lat: first.geometry.location.lat, lng: first.geometry.location.lng };
  } catch {
    return null;
  }
}

function parseCost(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim()
    .replace(/\b(KRW|USD|GBP|JPY|EUR|AUD)\b/gi, "")
    .replace(/[£$€¥]/g, "")
    .replace(/,/g, "")
    .trim();
  const n = parseFloat(cleaned);
  return isNaN(n) || n <= 0 ? null : n;
}

function detectCurrency(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw);
  if (/\bKRW\b/i.test(s)) return "KRW";
  if (/\bGBP\b/i.test(s) || s.includes("£")) return "GBP";
  if (/\bEUR\b/i.test(s) || s.includes("€")) return "EUR";
  if (/\bJPY\b/i.test(s) || s.includes("¥")) return "JPY";
  if (/\bAUD\b/i.test(s)) return "AUD";
  if (/\bUSD\b/i.test(s) || s.includes("$")) return "USD";
  return null;
}

/**
 * Mirrors getDayIndex from the email webhook exactly — including the 12h
 * shift to avoid UTC midnight boundary issues with dates stored in JST.
 */
function getDayIndex(tripStartDate: Date, scheduledDateStr: string): number {
  const shiftedStart = new Date(tripStartDate.getTime() + 12 * 60 * 60 * 1000);
  const start = new Date(
    shiftedStart.getUTCFullYear(),
    shiftedStart.getUTCMonth(),
    shiftedStart.getUTCDate()
  );
  const [y, m, d] = scheduledDateStr.split("-").map(Number);
  const idx = Math.round(
    (new Date(y, m - 1, d).getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(0, idx);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Load all booking vault docs across all trips/users
  const docs = await db.tripDocument.findMany({
    where: { type: "booking" },
    select: { id: true, tripId: true, label: true, content: true },
  });
  console.log(`[backfill] found ${docs.length} booking vault documents`);

  // Load all trips (need startDate and destinationCity for geocoding)
  const trips = await db.trip.findMany({
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      destinationCity: true,
      destinationCountry: true,
    },
  });
  const tripMap = new Map(trips.map((t) => [t.id, t]));

  // Load all existing ItineraryItems for dedup lookups
  const existingItems = await db.itineraryItem.findMany({
    select: { tripId: true, title: true, confirmationCode: true, type: true },
  });

  // Per-trip sets for fast dedup
  const confByTrip = new Map<string, Set<string>>();
  const titleByTrip = new Map<string, Set<string>>();
  for (const item of existingItems) {
    if (!confByTrip.has(item.tripId)) confByTrip.set(item.tripId, new Set());
    if (!titleByTrip.has(item.tripId)) titleByTrip.set(item.tripId, new Set());
    if (item.confirmationCode) confByTrip.get(item.tripId)!.add(item.confirmationCode);
    titleByTrip.get(item.tripId)!.add(item.title.toLowerCase());
  }

  let created = 0;
  let skipped = 0;

  for (const doc of docs) {
    let booking: Record<string, unknown> = {};
    try { booking = JSON.parse(doc.content ?? "{}"); } catch { continue; }

    const docType = (booking.type as string | null)?.toLowerCase();
    if (!["hotel", "train", "flight"].includes(docType ?? "")) continue;

    const trip = tripMap.get(doc.tripId);
    if (!trip?.startDate) {
      console.log(`[backfill] skipping "${doc.label}" — trip not found or no startDate`);
      continue;
    }

    const confCodes = confByTrip.get(doc.tripId) ?? new Set<string>();
    const titles = titleByTrip.get(doc.tripId) ?? new Set<string>();
    const confCode = (booking.confirmationCode as string | null) ?? null;

    // Dedup by confirmationCode — if any ItineraryItem for this trip already
    // has this code, the webhook already processed this booking. Skip entirely.
    if (confCode && confCodes.has(confCode)) {
      console.log(`[backfill] skipped "${doc.label}" — ItineraryItem already exists (confirmationCode: ${confCode})`);
      skipped++;
      continue;
    }

    // ── HOTEL ───────────────────────────────────────────────────────────────
    if (docType === "hotel") {
      const vendorName = (booking.vendorName as string | null) ?? doc.label;
      const checkInDate = (booking.checkIn as string | null) ?? null;
      const checkOutDate = (booking.checkOut as string | null) ?? null;
      const checkInTitle = `Check-in: ${vendorName}`;
      const checkOutTitle = `Check-out: ${vendorName}`;
      const checkInExists = titles.has(checkInTitle.toLowerCase());
      const checkOutExists = titles.has(checkOutTitle.toLowerCase());

      if (checkInExists && checkOutExists) {
        console.log(`[backfill] skipped "${doc.label}" — ItineraryItem already exists`);
        skipped++;
        continue;
      }

      const parsedCost = parseCost(booking.totalCost);
      const currency =
        detectCurrency(booking.totalCost) ?? (booking.currency as string | null) ?? "USD";

      // Geocode hotel: "[name] [destinationCity]" (mirrors webhook logic)
      const hotelCity = (booking.city as string | null) ?? trip.destinationCity ?? "";
      const geoQuery = `${vendorName}${hotelCity ? " " + hotelCity : ""}`;
      const geo = await geocodePlace(geoQuery);
      console.log(
        `[backfill] geocoding "${geoQuery}" → ${geo ? `lat: ${geo.lat}, lng: ${geo.lng}` : "no result"}`
      );

      if (!checkInExists && checkInDate) {
        const dayIndex = getDayIndex(trip.startDate, checkInDate);
        await db.itineraryItem.create({
          data: {
            tripId: doc.tripId,
            type: "LODGING",
            title: checkInTitle,
            scheduledDate: checkInDate,
            confirmationCode: confCode,
            totalCost: parsedCost,
            currency,
            dayIndex,
            ...(geo ? { latitude: geo.lat, longitude: geo.lng } : {}),
          },
        });
        console.log(
          `[backfill] created ItineraryItem "${checkInTitle}" for trip "${trip.title}" dayIndex: ${dayIndex} lat: ${geo?.lat ?? "n/a"} lng: ${geo?.lng ?? "n/a"}`
        );
        if (confCode) confCodes.add(confCode);
        titles.add(checkInTitle.toLowerCase());
        created++;
      }

      if (!checkOutExists && checkOutDate) {
        const dayIndex = getDayIndex(trip.startDate, checkOutDate);
        await db.itineraryItem.create({
          data: {
            tripId: doc.tripId,
            type: "LODGING",
            title: checkOutTitle,
            scheduledDate: checkOutDate,
            confirmationCode: confCode,
            totalCost: parsedCost,
            currency,
            dayIndex,
            ...(geo ? { latitude: geo.lat, longitude: geo.lng } : {}),
          },
        });
        console.log(
          `[backfill] created ItineraryItem "${checkOutTitle}" for trip "${trip.title}" dayIndex: ${dayIndex} lat: ${geo?.lat ?? "n/a"} lng: ${geo?.lng ?? "n/a"}`
        );
        titles.add(checkOutTitle.toLowerCase());
        created++;
      }

    // ── TRAIN ───────────────────────────────────────────────────────────────
    } else if (docType === "train") {
      const vendorName = (booking.vendorName as string | null) ?? doc.label;
      const fromCity = (booking.fromCity as string | null) ?? null;
      const toCity = (booking.toCity as string | null) ?? null;
      const titleText = fromCity && toCity ? `${fromCity} → ${toCity}` : vendorName;

      if (titles.has(titleText.toLowerCase())) {
        console.log(`[backfill] skipped "${doc.label}" — ItineraryItem already exists`);
        skipped++;
        continue;
      }

      const departureDate = (booking.departureDate as string | null) ?? null;
      const dayIndex = departureDate ? getDayIndex(trip.startDate, departureDate) : 0;
      const parsedCost = parseCost(booking.totalCost);
      const currency =
        detectCurrency(booking.totalCost) ?? (booking.currency as string | null) ?? "USD";

      // Geocode: "[fromCity] train station"
      const geoQuery = fromCity
        ? `${fromCity} train station`
        : trip.destinationCity
        ? `${trip.destinationCity} train station`
        : null;
      const geo = geoQuery ? await geocodePlace(geoQuery) : null;
      if (geoQuery) {
        console.log(
          `[backfill] geocoding "${geoQuery}" → ${geo ? `lat: ${geo.lat}, lng: ${geo.lng}` : "no result"}`
        );
      }

      await db.itineraryItem.create({
        data: {
          tripId: doc.tripId,
          type: "TRAIN",
          title: titleText,
          scheduledDate: departureDate,
          departureTime: (booking.departureTime as string | null) ?? null,
          arrivalTime: (booking.arrivalTime as string | null) ?? null,
          fromCity,
          toCity,
          confirmationCode: confCode,
          totalCost: parsedCost,
          currency,
          dayIndex,
          ...(geo ? { latitude: geo.lat, longitude: geo.lng } : {}),
        },
      });
      console.log(
        `[backfill] created ItineraryItem "${titleText}" for trip "${trip.title}" dayIndex: ${dayIndex} lat: ${geo?.lat ?? "n/a"} lng: ${geo?.lng ?? "n/a"}`
      );
      titles.add(titleText.toLowerCase());
      created++;

    // ── FLIGHT ──────────────────────────────────────────────────────────────
    } else if (docType === "flight") {
      const fromAirport = (booking.fromAirport as string | null) ?? null;
      const toAirport = (booking.toAirport as string | null) ?? null;
      const fromCity = (booking.fromCity as string | null) ?? null;
      const toCity = (booking.toCity as string | null) ?? null;
      const from = fromAirport ?? fromCity;
      const to = toAirport ?? toCity;
      const titleText =
        from && to
          ? `${from} → ${to}`
          : (booking.vendorName as string | null) ?? doc.label;

      if (titles.has(titleText.toLowerCase())) {
        console.log(`[backfill] skipped "${doc.label}" (flight "${titleText}") — ItineraryItem already exists`);
        skipped++;
        continue;
      }

      const departureDate = (booking.departureDate as string | null) ?? null;
      const dayIndex = departureDate ? getDayIndex(trip.startDate, departureDate) : 0;
      const parsedCost = parseCost(booking.totalCost);
      const currency =
        detectCurrency(booking.totalCost) ?? (booking.currency as string | null) ?? "USD";

      // Geocode: "[toAirport] airport" (arrival — where the family lands)
      const arrivalTarget = toAirport ?? toCity;
      const geoQuery = arrivalTarget ? `${arrivalTarget} airport` : null;
      const geo = geoQuery ? await geocodePlace(geoQuery) : null;
      if (geoQuery) {
        console.log(
          `[backfill] geocoding "${geoQuery}" → ${geo ? `lat: ${geo.lat}, lng: ${geo.lng}` : "no result"}`
        );
      }

      await db.itineraryItem.create({
        data: {
          tripId: doc.tripId,
          type: "FLIGHT",
          title: titleText,
          scheduledDate: departureDate,
          departureTime: (booking.departureTime as string | null) ?? null,
          arrivalTime: (booking.arrivalTime as string | null) ?? null,
          fromAirport,
          toAirport,
          fromCity,
          toCity,
          confirmationCode: confCode,
          totalCost: parsedCost,
          currency,
          dayIndex,
          ...(geo ? { latitude: geo.lat, longitude: geo.lng } : {}),
        },
      });
      console.log(
        `[backfill] created ItineraryItem "${titleText}" for trip "${trip.title}" dayIndex: ${dayIndex} lat: ${geo?.lat ?? "n/a"} lng: ${geo?.lng ?? "n/a"}`
      );
      titles.add(titleText.toLowerCase());
      created++;
    }
  }

  console.log(`\n[backfill] done. created: ${created}, skipped: ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
