import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 180;

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function flightUrgency(days: number): "now" | "soon" | "when ready" {
  if (days <= 30) return "now";
  if (days <= 90) return "soon";
  return "when ready";
}

function hotelUrgency(days: number): "now" | "soon" | "when ready" {
  if (days <= 21) return "now";
  if (days <= 60) return "soon";
  return "when ready";
}

function activityUrgency(days: number): "now" | "soon" | "when ready" {
  if (days <= 14) return "now";
  if (days <= 45) return "soon";
  return "when ready";
}

function docUrgency(days: number): "now" | "soon" | "when ready" {
  if (days <= 45) return "now";
  if (days <= 90) return "soon";
  return "when ready";
}

const HOTEL_RE = /lodg|hotel|hostel|resort|airbnb|accommodation|ryokan|villa|stay|inn/i;
const ACTIVITY_RE = /activit|museum|tour|ticket|admission|temple|shrine|park|concert|game|show|experience|attraction/i;
const INSURANCE_RE = /insurance|insur|travel protect|coverage|policy/i;
const VISA_RE = /visa|entry|passport|immigration|eta|evisa|customs/i;

type LogisticsItem = { title: string; reason: string; bookingUrl: string | null };

function getLogisticsItems(city: string | null, country: string | null): LogisticsItem[] {
  const c = (city ?? "").toLowerCase();
  const co = (country ?? "").toLowerCase();

  if (c.includes("seoul") || c.includes("busan") || c.includes("incheon") || co.includes("korea")) {
    return [
      { title: "T-money Card", reason: "Tap-to-pay on the metro, buses, and taxis — buy at Incheon Airport arrivals.", bookingUrl: "https://www.t-money.co.kr/ncs/pct/tmnyIntro/ReadTmnyIntroEng.do" },
    ];
  }
  if (c.includes("tokyo") || c.includes("osaka") || c.includes("kyoto") || c.includes("nara") || c.includes("hiroshima") || co.includes("japan")) {
    return [
      { title: "IC Card (Suica / ICOCA)", reason: "Cashless travel on trains, buses, and convenience stores — load at any station on arrival.", bookingUrl: "https://www.pasmo.co.jp/en/" },
    ];
  }
  if (c.includes("bali") || co.includes("indonesia")) {
    return [
      { title: "Indonesia e-VOA", reason: "Buy your visa online before arriving — saves queuing at immigration.", bookingUrl: "https://evisa.imigrasi.go.id/" },
    ];
  }
  if (c.includes("bangkok") || c.includes("chiang") || c.includes("phuket") || co.includes("thailand")) {
    return [
      { title: "SIM card / eSIM", reason: "Local data SIMs at Thai airports are cheap — activate an eSIM in advance to skip the queue.", bookingUrl: null },
    ];
  }
  if (c.includes("dubai") || c.includes("abu dhabi") || co.includes("emirates") || co.includes("uae")) {
    return [
      { title: "Nol Card", reason: "Rechargeable smart card for Dubai Metro, buses, and trams — buy at any station.", bookingUrl: "https://www.nolcard.ae/" },
    ];
  }
  if (c.includes("london") || co.includes("united kingdom") || co.includes("uk")) {
    return [
      { title: "Oyster Card / contactless", reason: "London's underground and buses use contactless payment — no need to pre-purchase.", bookingUrl: null },
    ];
  }
  if (co && !co.match(/^united states|canada|australia|new zealand/)) {
    return [
      { title: "International data plan", reason: "Check with your carrier or pick up a local SIM at the airport on arrival.", bookingUrl: null },
    ];
  }
  return [];
}

export type IntelItem = {
  id: string;
  category: "flights" | "hotel" | "activities" | "documents" | "logistics";
  title: string;
  reason: string;
  status: "booked" | "saved" | "missing";
  savedCount?: number;
  bookingUrl: string | null;
  urgency: "now" | "soon" | "when ready";
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: {
      destinationCity: true,
      destinationCountry: true,
      startDate: true,
      endDate: true,
      flights: { select: { id: true, type: true, status: true } },
      savedItems: { select: { categoryTags: true, isBooked: true } },
      manualActivities: { select: { status: true } },
      itineraryItems: { select: { type: true } },
      keyInfo: { select: { label: true, value: true } },
      documents: { select: { label: true } },
    },
  });

  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!trip.startDate) return NextResponse.json({ show: false });

  const daysAway = daysUntil(trip.startDate);
  // Show during the trip (daysAway <= 0) until the day after it ends
  const daysUntilEnd = trip.endDate ? daysUntil(trip.endDate) : daysAway;
  if (daysUntilEnd < -1 || daysAway > WINDOW_DAYS) return NextResponse.json({ show: false });

  const items: IntelItem[] = [];
  const { destinationCity, destinationCountry, flights, savedItems, manualActivities, itineraryItems, keyInfo, documents } = trip;

  // ── Flights ────────────────────────────────────────────────────────────────
  const bookedFlights = flights.filter((f) => f.status === "booked");
  const unconfirmedFlights = flights.filter((f) => f.status !== "booked");
  if (bookedFlights.length > 0) {
    const detail = bookedFlights.length === 1
      ? "outbound flight confirmed"
      : `${bookedFlights.length} flights confirmed`;
    items.push({
      id: "flights",
      category: "flights",
      title: "Flights",
      reason: `${detail}${unconfirmedFlights.length > 0 ? ` — ${unconfirmedFlights.length} still unconfirmed` : ""}`,
      status: unconfirmedFlights.length > 0 ? "saved" : "booked",
      savedCount: unconfirmedFlights.length > 0 ? unconfirmedFlights.length : undefined,
      urgency: unconfirmedFlights.length > 0 ? flightUrgency(daysAway) : "when ready",
      bookingUrl: null,
    });
  } else if (unconfirmedFlights.length > 0) {
    items.push({
      id: "flights",
      category: "flights",
      title: "Flights",
      reason: `${unconfirmedFlights.length} flight${unconfirmedFlights.length > 1 ? "s" : ""} saved but not confirmed — mark as booked once purchased.`,
      status: "saved",
      savedCount: unconfirmedFlights.length,
      urgency: flightUrgency(daysAway),
      bookingUrl: null,
    });
  } else {
    items.push({
      id: "flights",
      category: "flights",
      title: "Flights",
      reason: "No flights saved — fares tend to rise as the date approaches.",
      status: "missing",
      urgency: flightUrgency(daysAway),
      bookingUrl: null,
    });
  }

  // ── Hotel / accommodation ──────────────────────────────────────────────────
  const allLodging = savedItems.filter((s) => s.categoryTags.some((t) => HOTEL_RE.test(t)));
  const bookedLodging = allLodging.filter((s) => s.isBooked);
  const unconfirmedLodging = allLodging.filter((s) => !s.isBooked);
  // Email-imported hotel bookings live in ItineraryItem with type LODGING
  const itineraryLodging = itineraryItems.filter((i) => HOTEL_RE.test(i.type));
  const totalBookedLodging = bookedLodging.length + itineraryLodging.length;
  if (totalBookedLodging > 0) {
    items.push({
      id: "hotel",
      category: "hotel",
      title: "Hotel / accommodation",
      reason: `${totalBookedLodging} place${totalBookedLodging > 1 ? "s" : ""} confirmed.`,
      status: "booked",
      urgency: "when ready",
      bookingUrl: null,
    });
  } else if (unconfirmedLodging.length > 0) {
    items.push({
      id: "hotel",
      category: "hotel",
      title: "Hotel / accommodation",
      reason: `${unconfirmedLodging.length} option${unconfirmedLodging.length > 1 ? "s" : ""} saved — confirm before they sell out.`,
      status: "saved",
      savedCount: unconfirmedLodging.length,
      urgency: hotelUrgency(daysAway),
      bookingUrl: null,
    });
  } else {
    items.push({
      id: "hotel",
      category: "hotel",
      title: "Hotel / accommodation",
      reason: `${destinationCity ? `${destinationCity} ` : ""}accommodation fills up — lock in your base early.`,
      status: "missing",
      urgency: hotelUrgency(daysAway),
      bookingUrl: null,
    });
  }

  // ── Activities ─────────────────────────────────────────────────────────────
  const allSavedAct = savedItems.filter((s) => s.categoryTags.some((t) => ACTIVITY_RE.test(t)));
  const bookedSavedAct = allSavedAct.filter((s) => s.isBooked);
  const bookedManualAct = manualActivities.filter((a) => a.status === "booked");
  const totalBooked = bookedSavedAct.length + bookedManualAct.length;
  const totalSaved = allSavedAct.length + manualActivities.filter((a) => a.status !== "booked").length;

  if (totalBooked > 0) {
    items.push({
      id: "activities",
      category: "activities",
      title: "Activities",
      reason: `${totalBooked} activit${totalBooked > 1 ? "ies" : "y"} confirmed.`,
      status: "booked",
      urgency: "when ready",
      bookingUrl: null,
    });
  } else if (totalSaved > 0) {
    items.push({
      id: "activities",
      category: "activities",
      title: "Activities",
      reason: `${totalSaved} saved — popular attractions book out weeks in advance.`,
      status: "saved",
      savedCount: totalSaved,
      urgency: activityUrgency(daysAway),
      bookingUrl: null,
    });
  } else if (daysAway <= 45) {
    items.push({
      id: "activities",
      category: "activities",
      title: "Activities & experiences",
      reason: `Popular tours and attractions in ${destinationCity ?? "your destination"} sell out — add and book early.`,
      status: "missing",
      urgency: activityUrgency(daysAway),
      bookingUrl: null,
    });
  }

  // ── Travel insurance ───────────────────────────────────────────────────────
  const hasInsurance =
    keyInfo.some((k) => INSURANCE_RE.test(k.label) || INSURANCE_RE.test(k.value)) ||
    documents.some((d) => INSURANCE_RE.test(d.label));
  if (!hasInsurance) {
    items.push({
      id: "insurance",
      category: "documents",
      title: "Travel insurance",
      reason: "Covers delays, cancellations, medical expenses, and lost baggage.",
      status: "missing",
      urgency: docUrgency(daysAway),
      bookingUrl: "https://www.insuremytrip.com/",
    });
  }

  // ── Visa & entry requirements ──────────────────────────────────────────────
  if (daysAway <= 90) {
    const hasVisaRecord =
      keyInfo.some((k) => VISA_RE.test(k.label)) ||
      documents.some((d) => VISA_RE.test(d.label));
    if (!hasVisaRecord) {
      items.push({
        id: "visa",
        category: "documents",
        title: "Visa & entry requirements",
        reason: `Confirm whether a visa or pre-arrival registration is required for ${destinationCountry ?? "your destination"}.`,
        status: "missing",
        urgency: docUrgency(daysAway),
        bookingUrl: null, // BookingIntelCard.getVisaUrl() provides country-specific URL
      });
    }
  }

  // ── Destination logistics ──────────────────────────────────────────────────
  const logistics = getLogisticsItems(destinationCity, destinationCountry);
  for (const item of logistics) {
    items.push({
      id: `logistics_${item.title}`,
      category: "logistics",
      title: item.title,
      reason: item.reason,
      status: "missing",
      urgency: daysAway <= 14 ? "soon" : "when ready",
      bookingUrl: item.bookingUrl,
    });
  }

  if (items.length === 0) return NextResponse.json({ show: false });

  return NextResponse.json({ show: true, items, daysAway });
}
