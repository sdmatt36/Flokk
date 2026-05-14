import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PdfFlightLeg = {
  flightNumber: string;
  airline: string;
  fromAirport: string;
  fromCity: string;
  toAirport: string;
  toCity: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string | null;
  arrivalTime: string | null;
  duration: string | null;
  cabinClass: string;
  seatNumbers: string | null;
  type: string;
};

export type PdfFlightBooking = {
  id: string;
  confirmationCode: string | null;
  airline: string | null;
  cabinClass: string;
  seatNumbers: string | null;
  notes: string | null;
  flights: PdfFlightLeg[];
};

// Email-imported confirmed bookings (LODGING, FLIGHT, TRAIN, ACTIVITY, etc.)
export type PdfItineraryItem = {
  id: string;
  type: string;
  title: string;
  flightNumber: string | null; // populated for FLIGHT type items only
  departureTime: string | null;
  arrivalTime: string | null;
  fromCity: string | null;
  toCity: string | null;
  fromAirport: string | null;
  toAirport: string | null;
  confirmationCode: string | null;
  notes: string | null;
  address: string | null;
  dayIndex: number | null; // 0-based
  sortOrder: number;
};

// Saved spots assigned to a day (restaurants, attractions, etc.)
export type PdfSpot = {
  id: string;
  rawTitle: string;
  rawDescription: string | null;
  startTime: string | null;
  categoryTags: string[];
  destinationCity: string | null;
  dayIndex: number; // 0-based, guaranteed non-null
  sortOrder: number;
};

// Manually added activities
export type PdfActivity = {
  id: string;
  title: string;
  time: string | null;
  endTime: string | null;
  venueName: string | null;
  address: string | null;
  notes: string | null;
  dayIndex: number | null; // 0-based
  sortOrder: number;
  type: string | null;
};

export type PdfContact = {
  name: string;
  role: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  notes: string | null;
};

export type PdfKeyInfo = {
  label: string;
  value: string;
};

export type TripPDFProps = {
  tripTitle: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  startDate: string | null;
  endDate: string | null;
  heroImageUrl: string | null;
  familyName: string | null;
  members: Array<{ name: string | null; role: string }>;
  flightBookings: PdfFlightBooking[];
  itineraryItems: PdfItineraryItem[];
  spots: PdfSpot[];
  activities: PdfActivity[];
  contacts: PdfContact[];
  keyInfo: PdfKeyInfo[];
  generatedDate: string;
};

// ─── Tokens ──────────────────────────────────────────────────────────────────

const NAVY = "#1B3A5C";
const TERRA = "#C4664A";
const TAN = "#F5F0E8";
const BORDER = "#E0D8CC";
const MUTED = "#666666";
const WHITE = "#FFFFFF";
const DARK = "#1A1A1A";

const BOOKING_TYPE_LABEL: Record<string, string> = {
  FLIGHT: "FLIGHT",
  LODGING: "LODGING",
  TRAIN: "TRAIN",
  ACTIVITY: "ACTIVITY",
  CAR_RENTAL: "CAR RENTAL",
  RESTAURANT: "RESTAURANT",
  CRUISE_PORT: "CRUISE",
  OTHER: "OTHER",
};

const BOOKING_TYPE_COLOR: Record<string, string> = {
  FLIGHT: NAVY,
  LODGING: "#4A7C59",
  TRAIN: "#3B6E9E",
  ACTIVITY: TERRA,
  CAR_RENTAL: "#7A6348",
  RESTAURANT: "#8B5E83",
  CRUISE_PORT: "#2B6CB0",
  OTHER: "#888888",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "";
  try {
    const s = new Date(start).toLocaleDateString("en-US", { month: "long", day: "numeric" });
    if (!end) return s;
    const e = new Date(end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    return `${s} – ${e}`;
  } catch {
    return "";
  }
}

// dayIndex is 0-based: 0 = first day of trip
function buildDayLabel(startDate: string | null, dayIndex: number): string {
  const num = dayIndex + 1;
  if (!startDate) return `Day ${num}`;
  try {
    const base = new Date(startDate);
    base.setUTCDate(base.getUTCDate() + dayIndex);
    const dow = base.toLocaleDateString("en-US", { weekday: "long" });
    const date = base.toLocaleDateString("en-US", { month: "long", day: "numeric" });
    return `Day ${num}  ·  ${dow}, ${date}`;
  } catch {
    return `Day ${num}`;
  }
}

function cleanDescription(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw;
  s = s.replace(/^\d[\d,.KkMmBb]*\s*likes?,[\s\S]*?:\s*/i, "");
  s = s.replace(/^[\w.]+\s+on\s+\w+:\s*/i, "");
  s = s.replace(/#\w+/g, "");
  s = s.replace(/[\s.,"'"""]+$/, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  return s.length > 220 ? s.substring(0, 220) + "…" : s;
}

function categoryBadgeLabel(tags: string[]): string {
  if (!tags.length) return "SPOT";
  return tags[0].toUpperCase().replace(/_/g, " ");
}

function categoryBadgeColor(tags: string[]): string {
  const tag = (tags[0] ?? "").toLowerCase();
  if (tag.includes("restaurant") || tag.includes("food") || tag.includes("dining")) return "#8B5E83";
  if (tag.includes("museum") || tag.includes("art") || tag.includes("culture") || tag.includes("history")) return "#7A6348";
  if (tag.includes("nature") || tag.includes("park") || tag.includes("outdoor") || tag.includes("hike")) return "#4A7C59";
  if (tag.includes("beach") || tag.includes("water") || tag.includes("ocean")) return "#3B6E9E";
  return TERRA;
}

// Unified day entry for sorting across all item types
type DayEntry =
  | { kind: "booking"; sortOrder: number; time: string | null; item: PdfItineraryItem }
  | { kind: "spot";    sortOrder: number; time: string | null; item: PdfSpot }
  | { kind: "activity"; sortOrder: number; time: string | null; item: PdfActivity };

function timeToMinutes(t: string | null): number {
  if (!t) return 9999;
  const parts = t.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function sortDayEntries(entries: DayEntry[]): DayEntry[] {
  return [...entries].sort((a, b) => {
    const ta = timeToMinutes(a.time);
    const tb = timeToMinutes(b.time);
    if (ta !== tb) return ta - tb;
    return a.sortOrder - b.sortOrder;
  });
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 11,
    color: DARK,
    paddingTop: 44,
    paddingBottom: 56,
    paddingLeft: 44,
    paddingRight: 44,
  },

  // Cover
  coverHeroWrap: { height: 200, marginBottom: 28, position: "relative", borderRadius: 4 },
  coverHeroImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  coverHeroOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.48)" },
  coverNavyFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: NAVY },
  coverTextWrap: { position: "absolute", bottom: 0, left: 0, right: 0, paddingLeft: 24, paddingRight: 24, paddingBottom: 24, paddingTop: 24 },
  coverTitle: { fontFamily: "Helvetica-Bold", fontSize: 26, color: WHITE, lineHeight: 1.2 },
  coverSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 5 },
  coverDates: { fontSize: 11, color: "rgba(255,255,255,0.72)", marginTop: 3 },
  coverFamilySection: { paddingTop: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: BORDER },
  coverFamilyName: { fontFamily: "Helvetica-Bold", fontSize: 18, color: NAVY },
  coverMembers: { fontSize: 11, color: MUTED, marginTop: 6, lineHeight: 1.6 },
  coverContentsHead: { fontFamily: "Helvetica-Bold", fontSize: 11, color: NAVY, marginTop: 20, marginBottom: 8 },
  coverContentsBullet: { fontSize: 10, color: "#444444", marginBottom: 4 },
  coverFooter: { fontSize: 9, color: "#AAAAAA", marginTop: 20 },

  // Section header
  sectionHeader: { fontFamily: "Helvetica-Bold", fontSize: 15, color: TERRA, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: TERRA, marginBottom: 18 },

  // Day header
  dayHeaderWrap: { backgroundColor: NAVY, paddingTop: 9, paddingBottom: 9, paddingLeft: 14, paddingRight: 14, marginTop: 22, marginBottom: 10, borderRadius: 3 },
  dayHeaderText: { fontFamily: "Helvetica-Bold", fontSize: 11, color: WHITE, letterSpacing: 0.3 },

  // Shared item card base
  itemWrap: { marginBottom: 10, paddingLeft: 12, paddingTop: 10, paddingBottom: 10, paddingRight: 10, borderLeftWidth: 3, borderLeftColor: TERRA, backgroundColor: "#FAFAF8" },
  itemRow1: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  itemBadge: { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 0.8, color: WHITE, paddingTop: 2, paddingBottom: 2, paddingLeft: 5, paddingRight: 5, borderRadius: 2, marginRight: 8 },
  itemTime: { fontSize: 10, color: MUTED },
  itemTitle: { fontFamily: "Helvetica-Bold", fontSize: 12, color: DARK },
  itemDetail: { fontSize: 10, color: MUTED, marginTop: 3 },
  itemConf: { fontFamily: "Courier", fontSize: 9, color: NAVY, backgroundColor: TAN, paddingTop: 2, paddingBottom: 2, paddingLeft: 6, paddingRight: 6, borderRadius: 2, marginTop: 5 },
  itemNotes: { fontSize: 9, color: "#888888", marginTop: 5, fontStyle: "italic" },
  itemDesc: { fontSize: 10, color: "#555555", marginTop: 3, lineHeight: 1.4 },

  // Flight card
  flightCard: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, paddingTop: 14, paddingBottom: 14, paddingLeft: 14, paddingRight: 14, marginBottom: 14 },
  flightCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  flightAirline: { fontFamily: "Helvetica-Bold", fontSize: 13, color: NAVY },
  flightMeta: { fontSize: 9, color: MUTED, marginTop: 2 },
  flightConf: { fontFamily: "Courier", fontSize: 14, color: TERRA, backgroundColor: TAN, paddingTop: 5, paddingBottom: 5, paddingLeft: 12, paddingRight: 12, borderRadius: 3 },
  legRow: { flexDirection: "row", alignItems: "flex-start", paddingTop: 9, borderTopWidth: 1, borderTopColor: "#F0EDE6", marginTop: 4 },
  legFlightNum: { fontFamily: "Helvetica-Bold", fontSize: 11, color: NAVY, width: 64, paddingTop: 1 },
  legMain: { flex: 1 },
  legRoute: { fontFamily: "Helvetica-Bold", fontSize: 11, color: DARK },
  legDetail: { fontSize: 10, color: MUTED, marginTop: 2 },

  // Contacts
  contactsColHead: { fontFamily: "Helvetica-Bold", fontSize: 8, color: NAVY, letterSpacing: 0.5 },
  contactRow: { flexDirection: "row", paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F0EDE6", alignItems: "flex-start" },
  contactName: { fontFamily: "Helvetica-Bold", fontSize: 10, color: DARK, flex: 2 },
  contactPhone: { fontSize: 10, color: NAVY, flex: 2 },
  contactEmail: { fontSize: 9, color: MUTED, flex: 2 },
  keyInfoRow: { flexDirection: "row", paddingTop: 9, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: "#F0EDE6", alignItems: "flex-start" },
  keyInfoLabel: { fontFamily: "Helvetica-Bold", fontSize: 10, color: NAVY, flex: 2 },
  keyInfoValue: { fontSize: 10, color: DARK, flex: 3 },

  pageNum: { position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", fontSize: 9, color: "#BBBBBB", fontFamily: "Helvetica" },
});

// ─── Item blocks ─────────────────────────────────────────────────────────────

function BookingBlock({ item }: { item: PdfItineraryItem }) {
  const label = BOOKING_TYPE_LABEL[item.type] ?? item.type;
  const color = BOOKING_TYPE_COLOR[item.type] ?? "#888888";
  const route = item.fromCity && item.toCity
    ? `${item.fromCity}${item.fromAirport ? ` (${item.fromAirport})` : ""} → ${item.toCity}${item.toAirport ? ` (${item.toAirport})` : ""}`
    : null;
  const timeStr = [item.departureTime, item.arrivalTime].filter(Boolean).join(" – ");

  return (
    <View style={s.itemWrap} wrap={false}>
      <View style={s.itemRow1}>
        <Text style={{ ...s.itemBadge, backgroundColor: color }}>{label}</Text>
        {item.flightNumber ? (
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11, color: NAVY, marginRight: 10 }}>
            {item.flightNumber}
          </Text>
        ) : null}
        {timeStr ? <Text style={s.itemTime}>{timeStr}</Text> : null}
      </View>
      <Text style={s.itemTitle}>{item.title}</Text>
      {route ? <Text style={s.itemDetail}>{route}</Text> : null}
      {!route && item.address ? <Text style={s.itemDetail}>{item.address}</Text> : null}
      {item.confirmationCode ? (
        <Text style={s.itemConf}>Confirmation: {item.confirmationCode}</Text>
      ) : null}
      {item.notes ? <Text style={s.itemNotes}>{item.notes}</Text> : null}
    </View>
  );
}

function SpotBlock({ item }: { item: PdfSpot }) {
  const badgeLabel = categoryBadgeLabel(item.categoryTags);
  const badgeColor = categoryBadgeColor(item.categoryTags);
  const desc = cleanDescription(item.rawDescription);

  return (
    <View style={s.itemWrap} wrap={false}>
      <View style={s.itemRow1}>
        <Text style={{ ...s.itemBadge, backgroundColor: badgeColor }}>{badgeLabel}</Text>
        {item.startTime ? <Text style={s.itemTime}>{item.startTime}</Text> : null}
      </View>
      <Text style={s.itemTitle}>{item.rawTitle}</Text>
      {desc ? <Text style={s.itemDesc}>{desc}</Text> : null}
      {item.destinationCity ? <Text style={s.itemDetail}>{item.destinationCity}</Text> : null}
    </View>
  );
}

function ActivityBlock({ item }: { item: PdfActivity }) {
  const timeStr = [item.time, item.endTime].filter(Boolean).join(" – ");
  const location = item.venueName ?? item.address ?? null;

  return (
    <View style={s.itemWrap} wrap={false}>
      <View style={s.itemRow1}>
        <Text style={{ ...s.itemBadge, backgroundColor: TERRA }}>
          {(item.type ?? "ACTIVITY").toUpperCase()}
        </Text>
        {timeStr ? <Text style={s.itemTime}>{timeStr}</Text> : null}
      </View>
      <Text style={s.itemTitle}>{item.title}</Text>
      {location ? <Text style={s.itemDetail}>{location}</Text> : null}
      {item.address && item.venueName && item.address !== item.venueName ? (
        <Text style={s.itemDetail}>{item.address}</Text>
      ) : null}
      {item.notes ? <Text style={s.itemNotes}>{item.notes}</Text> : null}
    </View>
  );
}

function FlightCard({ booking }: { booking: PdfFlightBooking }) {
  const cabinLine = [booking.cabinClass, booking.seatNumbers ? `Seats: ${booking.seatNumbers}` : null]
    .filter(Boolean).join("  ·  ");

  return (
    <View style={s.flightCard} wrap={false}>
      <View style={s.flightCardTop}>
        <View>
          <Text style={s.flightAirline}>{booking.airline ?? "Flight"}</Text>
          {cabinLine ? <Text style={s.flightMeta}>{cabinLine}</Text> : null}
        </View>
        {booking.confirmationCode ? (
          <Text style={s.flightConf}>{booking.confirmationCode}</Text>
        ) : null}
      </View>
      {booking.flights.map((leg, i) => {
        const timeStr = leg.departureTime
          ? `${leg.departureTime}${leg.arrivalTime ? ` – ${leg.arrivalTime}` : ""}${leg.arrivalDate && leg.arrivalDate !== leg.departureDate ? " (+1)" : ""}`
          : "";
        const details = [leg.departureDate, timeStr, leg.duration].filter(Boolean).join("  ·  ");
        const perLegCabin = leg.cabinClass && leg.cabinClass !== booking.cabinClass ? `Cabin: ${leg.cabinClass}` : null;
        const perLegSeats = leg.seatNumbers && leg.seatNumbers !== booking.seatNumbers ? `Seats: ${leg.seatNumbers}` : null;

        return (
          <View key={i} style={s.legRow}>
            <Text style={s.legFlightNum}>{leg.flightNumber}</Text>
            <View style={s.legMain}>
              <Text style={s.legRoute}>{leg.fromAirport} → {leg.toAirport}</Text>
              <Text style={s.legDetail}>{leg.fromCity} → {leg.toCity}</Text>
              {details ? <Text style={s.legDetail}>{details}</Text> : null}
              {perLegCabin ? <Text style={s.legDetail}>{perLegCabin}</Text> : null}
              {perLegSeats ? <Text style={s.legDetail}>{perLegSeats}</Text> : null}
            </View>
          </View>
        );
      })}
      {booking.notes ? (
        <Text style={{ fontSize: 9, color: MUTED, marginTop: 10, fontStyle: "italic" }}>{booking.notes}</Text>
      ) : null}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TripItineraryPDF({
  tripTitle,
  destinationCity,
  destinationCountry,
  startDate,
  endDate,
  heroImageUrl,
  familyName,
  members,
  flightBookings,
  itineraryItems,
  spots,
  activities,
  contacts,
  keyInfo,
  generatedDate,
}: TripPDFProps) {
  // Build unified day map — all three item types, 0-based dayIndex
  const byDay = new Map<number, DayEntry[]>();

  function addToDay(dayIndex: number | null, entry: DayEntry) {
    if (dayIndex === null) return;
    if (!byDay.has(dayIndex)) byDay.set(dayIndex, []);
    byDay.get(dayIndex)!.push(entry);
  }

  for (const item of itineraryItems) {
    addToDay(item.dayIndex, { kind: "booking", sortOrder: item.sortOrder, time: item.departureTime, item });
  }
  for (const item of spots) {
    addToDay(item.dayIndex, { kind: "spot", sortOrder: item.sortOrder, time: item.startTime, item });
  }
  for (const item of activities) {
    addToDay(item.dayIndex, { kind: "activity", sortOrder: item.sortOrder, time: item.time, item });
  }

  for (const [, entries] of byDay) {
    const sorted = sortDayEntries(entries);
    byDay.set([...byDay.entries()].find(([, v]) => v === entries)![0], sorted);
  }

  const sortedDays = [...byDay.keys()].sort((a, b) => a - b);
  const hasItinerary = sortedDays.length > 0;
  const hasFlights = flightBookings.length > 0;
  const hasContacts = contacts.length > 0 || keyInfo.length > 0;

  const destination = [destinationCity, destinationCountry].filter(Boolean).join(", ");
  const dateRange = formatDateRange(startDate, endDate);
  const memberNames = members.filter((m) => m.name).map((m) => m.name!);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageNum = <Text style={s.pageNum} render={({ pageNumber, totalPages }: any) => `${pageNumber} / ${totalPages}`} fixed />;

  return (
    <Document title={tripTitle} author="Flokk">
      {/* ── COVER ── */}
      <Page size="A4" style={s.page}>
        <View style={s.coverHeroWrap}>
          {heroImageUrl ? (
            <>
              <Image src={heroImageUrl} style={s.coverHeroImg} />
              <View style={s.coverHeroOverlay} />
            </>
          ) : (
            <View style={s.coverNavyFill} />
          )}
          <View style={s.coverTextWrap}>
            <Text style={s.coverTitle}>{tripTitle}</Text>
            {destination ? <Text style={s.coverSubtitle}>{destination}</Text> : null}
            {dateRange ? <Text style={s.coverDates}>{dateRange}</Text> : null}
          </View>
        </View>

        <View style={s.coverFamilySection}>
          {familyName ? <Text style={s.coverFamilyName}>{familyName}</Text> : null}
          {memberNames.length > 0 ? (
            <Text style={s.coverMembers}>{memberNames.join("  ·  ")}</Text>
          ) : null}
        </View>

        <Text style={s.coverContentsHead}>This itinerary includes:</Text>
        {hasFlights ? <Text style={s.coverContentsBullet}>• Flight bookings and confirmation codes</Text> : null}
        {hasItinerary ? <Text style={s.coverContentsBullet}>• Day-by-day schedule</Text> : null}
        {hasContacts ? <Text style={s.coverContentsBullet}>• Emergency contacts and key information</Text> : null}

        <Text style={s.coverFooter}>Generated by Flokk  ·  {generatedDate}</Text>
        {pageNum}
      </Page>

      {/* ── FLIGHTS ── */}
      {hasFlights ? (
        <Page size="A4" style={s.page}>
          <Text style={s.sectionHeader}>Flights</Text>
          {flightBookings.map((b) => <FlightCard key={b.id} booking={b} />)}
          {pageNum}
        </Page>
      ) : null}

      {/* ── ITINERARY ── */}
      {hasItinerary ? (
        <Page size="A4" style={s.page}>
          <Text style={s.sectionHeader}>Day-by-Day Itinerary</Text>
          {sortedDays.map((dayIndex) => {
            const entries = byDay.get(dayIndex) ?? [];
            return (
              <View key={dayIndex}>
                <View style={s.dayHeaderWrap} wrap={false}>
                  <Text style={s.dayHeaderText}>{buildDayLabel(startDate, dayIndex)}</Text>
                </View>
                {entries.map((entry, i) => {
                  if (entry.kind === "booking") return <BookingBlock key={`b-${i}`} item={entry.item} />;
                  if (entry.kind === "spot") return <SpotBlock key={`s-${i}`} item={entry.item} />;
                  return <ActivityBlock key={`a-${i}`} item={entry.item} />;
                })}
              </View>
            );
          })}
          {pageNum}
        </Page>
      ) : null}

      {/* ── CONTACTS ── */}
      {hasContacts ? (
        <Page size="A4" style={s.page}>
          <Text style={s.sectionHeader}>Contacts & Key Info</Text>

          {contacts.length > 0 ? (
            <View>
              <View style={{ flexDirection: "row", paddingBottom: 5, borderBottomWidth: 1.5, borderBottomColor: NAVY, marginBottom: 4 }}>
                <Text style={{ ...s.contactsColHead, flex: 2 }}>NAME / ROLE</Text>
                <Text style={{ ...s.contactsColHead, flex: 2 }}>PHONE</Text>
                <Text style={{ ...s.contactsColHead, flex: 2 }}>EMAIL</Text>
              </View>
              {contacts.map((c, i) => (
                <View key={i} style={s.contactRow} wrap={false}>
                  <View style={{ flex: 2 }}>
                    <Text style={s.contactName}>{c.name}</Text>
                    {c.role ? <Text style={{ fontSize: 9, color: MUTED }}>{c.role}</Text> : null}
                    {c.notes ? <Text style={{ fontSize: 9, color: "#999999", fontStyle: "italic" }}>{c.notes}</Text> : null}
                  </View>
                  <Text style={{ ...s.contactPhone, flex: 2 }}>{c.phone ?? c.whatsapp ?? "—"}</Text>
                  <Text style={{ ...s.contactEmail, flex: 2 }}>{c.email ?? "—"}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {keyInfo.length > 0 ? (
            <View style={{ marginTop: contacts.length > 0 ? 28 : 0 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12, color: NAVY, marginBottom: 10 }}>
                Key Information
              </Text>
              {keyInfo.map((k, i) => (
                <View key={i} style={s.keyInfoRow} wrap={false}>
                  <Text style={s.keyInfoLabel}>{k.label}</Text>
                  <Text style={s.keyInfoValue}>{k.value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {pageNum}
        </Page>
      ) : null}
    </Document>
  );
}
