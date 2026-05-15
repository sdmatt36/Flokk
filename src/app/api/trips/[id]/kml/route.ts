import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { getTripAccess } from "@/lib/trip-permissions";

export const dynamic = "force-dynamic";

function escXml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// KML icon style IDs
const STYLE = {
  spot:      "spot",
  lodging:   "lodging",
  activity:  "activity",
  transport: "transport",
  restaurant:"restaurant",
} as const;

function kmlStyles(): string {
  const defs: Array<{ id: string; color: string; scale: number }> = [
    { id: STYLE.spot,       color: "ffa06040", scale: 1.1 },   // terracotta
    { id: STYLE.lodging,    color: "ff5c3a1b", scale: 1.1 },   // navy
    { id: STYLE.activity,   color: "ff4a7c59", scale: 1.0 },   // green
    { id: STYLE.transport,  color: "ff8a6000", scale: 0.9 },   // amber
    { id: STYLE.restaurant, color: "ff2030a0", scale: 1.0 },   // blue
  ];
  return defs.map(({ id, color, scale }) => `
  <Style id="${id}">
    <IconStyle>
      <color>${color}</color>
      <scale>${scale}</scale>
      <Icon><href>https://maps.google.com/mapfiles/kml/paddle/wht-circle.png</href></Icon>
    </IconStyle>
    <LabelStyle><scale>0.8</scale></LabelStyle>
  </Style>`).join("");
}

function placemark(opts: {
  name: string;
  description?: string;
  lat: number;
  lng: number;
  styleId: string;
  folderHint?: string;
}): string {
  return `
  <Placemark>
    <name>${escXml(opts.name)}</name>
    ${opts.description ? `<description><![CDATA[${opts.description}]]></description>` : ""}
    <styleUrl>#${opts.styleId}</styleUrl>
    <Point><coordinates>${opts.lng},${opts.lat},0</coordinates></Point>
  </Placemark>`;
}

function itineraryItemStyle(type: string): keyof typeof STYLE {
  switch (type) {
    case "LODGING": return "lodging";
    case "FLIGHT":
    case "TRAIN":
    case "CAR_RENTAL": return "transport";
    case "RESTAURANT": return "restaurant";
    default: return "activity";
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const access = await getTripAccess(profileId, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [trip, spots, activities, itineraryItems] = await Promise.all([
    db.trip.findUnique({
      where: { id },
      select: { title: true, destinationCity: true, destinationCountry: true },
    }),
    db.savedItem.findMany({
      where: { tripId: id, deletedAt: null, lat: { not: null }, lng: { not: null } },
      select: {
        rawTitle: true, rawDescription: true, lat: true, lng: true,
        categoryTags: true, destinationCity: true, websiteUrl: true,
        dayIndex: true, userNote: true,
      },
      orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }],
    }),
    db.manualActivity.findMany({
      where: { tripId: id, deletedAt: null },
      select: { title: true, venueName: true, address: true, lat: true, lng: true, notes: true, dayIndex: true },
      orderBy: [{ dayIndex: "asc" }, { time: "asc" }],
    }),
    db.itineraryItem.findMany({
      where: { tripId: id, cancelledAt: null, latitude: { not: null }, longitude: { not: null } },
      select: {
        title: true, type: true, address: true, notes: true,
        latitude: true, longitude: true, confirmationCode: true, dayIndex: true,
      },
      orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tripName = trip.title || `${trip.destinationCity} Trip`;

  // Build folders: one per day for spots + activities, one for bookings
  const dayMap = new Map<number | null, string[]>();
  const bookingsFolder: string[] = [];

  for (const s of spots) {
    if (!s.lat || !s.lng) continue;
    const key = s.dayIndex ?? null;
    if (!dayMap.has(key)) dayMap.set(key, []);
    const desc = [
      s.rawDescription,
      s.websiteUrl ? `<a href="${escXml(s.websiteUrl)}">${escXml(s.websiteUrl)}</a>` : null,
      s.userNote,
    ].filter(Boolean).join("<br/>");
    dayMap.get(key)!.push(placemark({
      name: s.rawTitle ?? "Saved place",
      description: desc || undefined,
      lat: s.lat,
      lng: s.lng,
      styleId: STYLE.spot,
    }));
  }

  for (const a of activities) {
    const key = a.dayIndex ?? null;
    if (!dayMap.has(key)) dayMap.set(key, []);
    const lat = a.lat ?? 0;
    const lng = a.lng ?? 0;
    if (!lat || !lng) continue;
    const desc = [a.venueName, a.address, a.notes].filter(Boolean).join(" · ");
    dayMap.get(key)!.push(placemark({
      name: a.title,
      description: desc || undefined,
      lat, lng,
      styleId: STYLE.activity,
    }));
  }

  for (const item of itineraryItems) {
    if (!item.latitude || !item.longitude) continue;
    const desc = [
      item.address,
      item.confirmationCode ? `Confirmation: ${item.confirmationCode}` : null,
      item.notes,
    ].filter(Boolean).join("<br/>");
    bookingsFolder.push(placemark({
      name: item.title,
      description: desc || undefined,
      lat: item.latitude,
      lng: item.longitude,
      styleId: itineraryItemStyle(item.type),
    }));
  }

  // Sort day keys
  const dayKeys = [...dayMap.keys()].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });

  const folders = dayKeys.map(day => {
    const label = day === null ? "Unscheduled" : `Day ${day + 1}`;
    const placemarks = dayMap.get(day)!;
    return `
  <Folder>
    <name>${label}</name>
    <open>0</open>
    ${placemarks.join("")}
  </Folder>`;
  });

  if (bookingsFolder.length > 0) {
    folders.push(`
  <Folder>
    <name>Bookings &amp; Reservations</name>
    <open>0</open>
    ${bookingsFolder.join("")}
  </Folder>`);
  }

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${escXml(tripName)}</name>
  <description>Exported from Flokk — flokktravel.com</description>
  ${kmlStyles()}
  ${folders.join("")}
</Document>
</kml>`;

  const safeName = tripName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  return new Response(kml, {
    headers: {
      "Content-Type": "application/vnd.google-earth.kml+xml",
      "Content-Disposition": `attachment; filename="${safeName}.kml"`,
      "Cache-Control": "no-store",
    },
  });
}
