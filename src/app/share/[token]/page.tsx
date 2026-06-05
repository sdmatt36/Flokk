import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getTripCoverImage } from "@/lib/destination-images";
import { mergeDuplicateLodging } from "@/lib/itinerary/merge-duplicate-lodging";
import { SharePageBottomBar } from "./SharePageBottomBar";
import {
  MapPin, CalendarDays, Bookmark, Route, Sparkle, Sparkles,
  CopyPlus, UsersRound, ArrowRight, Bird,
} from "lucide-react";

export const dynamic = "force-dynamic";

// ── Design tokens (matching the mock) ────────────────────────────────────────
const T = {
  navy:      "#1B3A5C",
  body:      "#53657A",
  muted:     "#8B99A8",
  terra:     "#C4664A",
  terraDeep: "#A8543B",
  paper:     "#FAF7F2",
  sheet:     "#FFFFFF",
  navyTint:  "rgba(27,58,92,0.055)",
  hair:      "rgba(27,58,92,0.09)",
  hair2:     "rgba(27,58,92,0.06)",
};
const display = '"Playfair Display", Georgia, serif';
const sans    = '"DM Sans", -apple-system, system-ui, sans-serif';

// ── generateMetadata (unchanged from prior version) ───────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const trip = await db.trip.findUnique({
    where: { shareToken: token },
    select: {
      title: true, destinationCity: true, destinationCountry: true,
      heroImageUrl: true, startDate: true, endDate: true,
    },
  });
  if (!trip) return { title: "Trip | Flokk" };
  const dest = [trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ");
  const days =
    trip.startDate && trip.endDate
      ? Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      : null;
  const heroImg = getTripCoverImage(trip.destinationCity, trip.destinationCountry, trip.heroImageUrl);
  const absoluteImg = heroImg.startsWith("http") ? heroImg : `https://flokktravel.com${heroImg}`;
  const title = `${trip.title}${dest ? ` · ${dest}` : ""}, shared on Flokk`;
  const description = days
    ? `${days}-day family trip to ${dest || trip.title}. See the full itinerary on Flokk.`
    : `Family trip to ${dest || trip.title}. See the full itinerary on Flokk.`;
  return {
    title,
    openGraph: {
      title, description,
      images: [{ url: absoluteImg, width: 1200, height: 630, alt: dest || trip.title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [absoluteImg] },
  };
}

// ── Tag-based family-fit derivation ──────────────────────────────────────────
const TAG_FIT_MAP: Array<{ pattern: RegExp; line: string; why: string; stopHint: string }> = [
  {
    pattern: /beach|ocean|snorkel|swim|surf|water park/i,
    line: "Perfect for water-loving families",
    why: "This itinerary is packed with water activities - beaches, snorkeling, and swim spots that kids of all ages tend to love.",
    stopHint: "Great for kids",
  },
  {
    pattern: /museum|history|heritage|ruins|culture|monument|palace/i,
    line: "Educational and hands-on",
    why: "History and culture woven throughout - the kind of trip families talk about long after they are home.",
    stopHint: "Educational stop",
  },
  {
    pattern: /theme park|amusement|roller|entertainment|show|performance/i,
    line: "Built for family fun",
    why: "Kid-focused entertainment and shows that work across age groups, so everyone stays in the game.",
    stopHint: "Family favourite",
  },
  {
    pattern: /food|restaurant|cuisine|market|dining|street food/i,
    line: "A foodie family’s dream",
    why: "This trip is built around local flavours - ideal for families who explore a new place through what they eat.",
    stopHint: "Try local flavours",
  },
  {
    pattern: /hike|trek|outdoor|nature|national park|wildlife|safari/i,
    line: "Great for active families",
    why: "Outdoor adventure and nature experiences that keep everyone moving and engaged.",
    stopHint: "Active adventure",
  },
  {
    pattern: /zoo|aquarium|animal/i,
    line: "Animals around every corner",
    why: "Animal encounters throughout - from zoos to wildlife sanctuaries - make for memorable family moments.",
    stopHint: "Animal encounter",
  },
  {
    pattern: /kids|family|playground|toddler|child/i,
    line: "Designed with kids in mind",
    why: "Every stop chosen by a family with kids - the pace and the picks are already dialed in.",
    stopHint: "Family favourite",
  },
];

function deriveFamilyFitLine(tags: string[]): string | null {
  const tagStr = tags.join(" ");
  for (const { pattern, line } of TAG_FIT_MAP) {
    if (pattern.test(tagStr)) return line;
  }
  return null;
}

function deriveTripFamilyFitCard(tags: string[]): string | null {
  const tagStr = tags.join(" ");
  for (const { pattern, why } of TAG_FIT_MAP) {
    if (pattern.test(tagStr)) return why;
  }
  return null;
}

function deriveStopFamilyFit(tags: string[]): string | null {
  const tagStr = tags.join(" ");
  for (const { pattern, stopHint } of TAG_FIT_MAP) {
    if (pattern.test(tagStr)) return stopHint;
  }
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDateRange(start: Date | null, end: Date | null): string | null {
  if (!start) return null;
  const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (!end) return startStr;
  const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startStr} - ${endStr}`;
}

function tripDays(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function dayLabelParts(tripStart: Date | null, idx: number): { label: string; date: string } {
  if (tripStart) {
    const d = new Date(tripStart);
    d.setDate(d.getDate() + (idx - 1));
    return {
      label: `Day ${idx}`,
      date: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    };
  }
  return { label: `Day ${idx}`, date: "" };
}

function timeToMin(t: string | null | undefined): number {
  if (!t) return 9999;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return 9999;
  return h * 60 + m;
}

const EXCLUDE_SAVE_TAGS = /flight|airfare|airline|lodging|accommodation|hotel|transportation/i;

const ITIN_CATEGORY: Record<string, string> = {
  FLIGHT: "Flight",
  TRAIN: "Train",
  LODGING: "Stay",
  ACTIVITY: "Activity",
};

// ── Value props for conversion panel ─────────────────────────────────────────
const CTA_PROPS = [
  {
    title: "Save from anywhere",
    body: "Instagram, TikTok, Maps, a screenshot. It all lands in one place.",
    icon: <Bookmark size={19} color="#C4664A" strokeWidth={2} />,
  },
  {
    title: "Built around your kids",
    body: "Ages, allergies and pace woven into every plan.",
    icon: <UsersRound size={19} color="#C4664A" strokeWidth={2} />,
  },
  {
    title: "A family-ready trip",
    body: "Turn a pile of saves into a day-by-day itinerary.",
    icon: <Sparkles size={19} color="#C4664A" strokeWidth={2} />,
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ preview?: string }>;
}) {
  const { token } = await params;
  const sp = searchParams ? await searchParams : ({} as { preview?: string });

  const trip = await db.trip.findUnique({
    where: { shareToken: token },
    include: {
      savedItems: { orderBy: [{ dayIndex: "asc" }, { savedAt: "asc" }] },
      itineraryItems: {
        where: { cancelledAt: null },
        orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }],
      },
      manualActivities: { orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }] },
      familyProfile: { select: { familyName: true } },
    },
  });

  if (!trip) notFound();

  // Increment viewCount (fire-and-forget)
  db.trip
    .update({ where: { id: trip.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  // Ownership check
  const previewMode = sp.preview === "true";
  const { userId } = await auth();
  let isOwner = false;
  if (userId) {
    const viewer = await db.user.findUnique({
      where: { clerkId: userId },
      select: { familyProfile: { select: { id: true } } },
    });
    isOwner =
      !previewMode &&
      !trip.isFlokkerExample &&
      viewer?.familyProfile?.id === trip.familyProfileId;
  }

  const heroImg = getTripCoverImage(
    trip.destinationCity,
    trip.destinationCountry,
    trip.heroImageUrl
  );
  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  const days = tripDays(trip.startDate, trip.endDate);
  const destination = [trip.destinationCity, trip.destinationCountry]
    .filter(Boolean)
    .join(", ");
  const tripDestination =
    trip.destinationCity ?? destination ?? "this destination";
  const totalActivityCount = trip.savedItems.length;

  // Family-fit derivation from all saved item tags
  const allTripTags = trip.savedItems.flatMap((s) => s.categoryTags);
  const familyFitLine = deriveFamilyFitLine(allTripTags);
  const familyFitWhy = deriveTripFamilyFitCard(allTripTags);

  // ── Build stops per day ───────────────────────────────────────────────────
  type StopRaw =
    | { kind: "itinerary"; data: typeof trip.itineraryItems[0]; sortKey: number }
    | { kind: "save"; data: typeof trip.savedItems[0]; sortKey: number }
    | { kind: "manual"; data: typeof trip.manualActivities[0]; sortKey: number };

  const rawByDay: Record<number, StopRaw[]> = {};
  const mergedItinItems = mergeDuplicateLodging(trip.itineraryItems);

  for (const item of mergedItinItems) {
    const di = item.dayIndex ?? 0;
    if (di <= 0) continue;
    if (item.type === "LODGING" && /check-out/i.test(item.title)) continue;
    if (!rawByDay[di]) rawByDay[di] = [];
    rawByDay[di].push({
      kind: "itinerary",
      data: item,
      sortKey: timeToMin(item.departureTime ?? item.arrivalTime),
    });
  }

  for (const save of trip.savedItems) {
    const di = save.dayIndex ?? 0;
    if (di <= 0) continue;
    if (!save.rawTitle) continue;
    if (EXCLUDE_SAVE_TAGS.test(save.categoryTags.join(" "))) continue;
    if (!rawByDay[di]) rawByDay[di] = [];
    rawByDay[di].push({
      kind: "save",
      data: save,
      sortKey: timeToMin(save.startTime),
    });
  }

  for (const ma of trip.manualActivities) {
    const di = ma.dayIndex ?? 0;
    if (di <= 0) continue;
    if (!rawByDay[di]) rawByDay[di] = [];
    rawByDay[di].push({
      kind: "manual",
      data: ma,
      sortKey: timeToMin(ma.time),
    });
  }

  for (const di of Object.keys(rawByDay).map(Number)) {
    rawByDay[di].sort((a, b) => a.sortKey - b.sortKey);
  }

  const allDayIndices =
    days != null
      ? Array.from({ length: days }, (_, i) => i + 1)
      : Object.keys(rawByDay).map(Number).sort((a, b) => a - b);

  // Render-only stop type — confirmationCode intentionally not included
  type StopItem = {
    id: string;
    title: string;
    category: string;
    time: string | null;
    familyFit: string | null;
  };
  type DayBlock = {
    index: number;
    label: string;
    date: string;
    stops: StopItem[];
  };

  const dayBlocks: DayBlock[] = allDayIndices
    .map((di): DayBlock => {
      const rawItems = rawByDay[di] ?? [];

      const manualTitlesForDay = new Set(
        rawItems
          .filter((e) => e.kind === "manual")
          .map((e) => (e.data as { title: string }).title.toLowerCase().trim())
      );
      const dedupedItems = rawItems.filter((e) => {
        if (e.kind !== "save") return true;
        const saveTitle = (
          (e.data as { rawTitle: string | null }).rawTitle ?? ""
        )
          .toLowerCase()
          .trim();
        return !manualTitlesForDay.has(saveTitle);
      });

      const stops: StopItem[] = dedupedItems.map((entry) => {
        if (entry.kind === "save") {
          const s = entry.data;
          return {
            id: `save_${s.id}`,
            title: s.rawTitle ?? "(untitled)",
            category: s.categoryTags[0] ?? "Activity",
            time: s.startTime ?? null,
            familyFit: deriveStopFamilyFit(s.categoryTags),
          };
        }
        if (entry.kind === "itinerary") {
          const it = entry.data;
          const displayTitle =
            it.type === "LODGING"
              ? it.title.replace(/^check-in:\s*/i, "")
              : it.title;
          const route =
            (it.type === "FLIGHT" || it.type === "TRAIN") &&
            it.fromAirport &&
            it.toAirport
              ? `${it.fromAirport} - ${it.toAirport}`
              : (it.type === "FLIGHT" || it.type === "TRAIN") &&
                it.fromCity &&
                it.toCity
              ? `${it.fromCity} - ${it.toCity}`
              : null;
          const time =
            it.departureTime && it.arrivalTime
              ? `${it.departureTime} - ${it.arrivalTime}`
              : it.departureTime ?? it.arrivalTime ?? null;
          return {
            id: `itin_${it.id}`,
            title: route ?? displayTitle,
            category: ITIN_CATEGORY[it.type] ?? "Activity",
            time,
            familyFit: null,
          };
        }
        // manual
        const ma = entry.data;
        return {
          id: `manual_${ma.id}`,
          title: ma.title,
          category: "Activity",
          time: ma.time ?? null,
          familyFit: null,
        };
      });

      const { label, date } = dayLabelParts(trip.startDate, di);
      return { index: di, label, date, stops };
    })
    .filter((d) => d.stops.length > 0);

  // Generated description (Trip has no description field)
  const tripDescription = destination
    ? days
      ? `${days} day${days !== 1 ? "s" : ""} in ${trip.destinationCity ?? destination}, saved, sorted and shared by a family on Flokk.`
      : `A trip to ${destination}, saved, sorted and shared by a family on Flokk.`
    : null;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.paper, paddingBottom: "120px" }}>

      {/* ── Sticky brand top bar ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(250,247,242,0.86)",
          backdropFilter: "blur(14px) saturate(150%)",
          WebkitBackdropFilter: "blur(14px) saturate(150%)",
          borderBottom: `1px solid ${T.hair2}`,
        }}
      >
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            padding: "13px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: T.navy,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Bird size={18} color="#fff" strokeWidth={2} />
            </span>
            <span
              style={{
                fontFamily: display,
                fontWeight: 700,
                fontSize: 22,
                color: T.navy,
                letterSpacing: "-0.3px",
              }}
            >
              Flokk
            </span>
          </div>
          <Link
            href="/sign-up"
            style={{
              backgroundColor: T.terra,
              color: "#fff",
              borderRadius: 999,
              padding: "9px 16px",
              fontFamily: sans,
              fontWeight: 600,
              fontSize: 13.5,
              textDecoration: "none",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(196,102,74,0.28)",
              display: "inline-block",
            }}
          >
            Plan your trip
          </Link>
        </div>
      </header>

      {/* ── Main content (760px max centered) ── */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 48px" }}>

        {/* ── Hero image ── */}
        <div
          style={{
            position: "relative",
            borderRadius: 22,
            overflow: "hidden",
            height: "clamp(230px, 42vw, 360px)",
            background: "linear-gradient(140deg,#D9CFBE,#BFB199)",
            backgroundImage: `url('${heroImg}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            boxShadow: "0 2px 10px rgba(27,58,92,0.07), 0 1px 2px rgba(27,58,92,0.04)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.45) 100%)",
            }}
          />
          <span
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              zIndex: 2,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              backgroundColor: T.terra,
              color: "#fff",
              borderRadius: 999,
              padding: "6px 12px",
              fontFamily: sans,
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              boxShadow: "0 3px 10px rgba(196,102,74,0.4)",
            }}
          >
            <Route size={12} color="#fff" strokeWidth={2.2} />
            Family itinerary
          </span>
        </div>

        {/* ── Head ── */}
        <div
          style={{
            fontFamily: sans,
            fontWeight: 700,
            fontSize: 10.5,
            lineHeight: "12px",
            letterSpacing: "0.7px",
            textTransform: "uppercase",
            color: T.terraDeep,
            marginTop: 22,
          }}
        >
          A family itinerary on Flokk
        </div>
        <h1
          style={{
            fontFamily: display,
            fontWeight: 600,
            fontSize: "clamp(28px,5.6vw,40px)",
            lineHeight: 1.08,
            color: T.navy,
            margin: "10px 0 0",
            letterSpacing: "-0.5px",
          }}
        >
          {trip.title}
        </h1>

        {/* Location + dates + spots */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          {destination && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontFamily: sans,
                fontWeight: 500,
                fontSize: 14.5,
                color: T.body,
              }}
            >
              <MapPin size={16} color={T.muted} strokeWidth={2} />
              {destination}
            </span>
          )}
          {dateRange && (
            <>
              <span
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: "50%",
                  background: "#AAB6C2",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontFamily: sans,
                  fontWeight: 500,
                  fontSize: 14.5,
                  color: T.body,
                }}
              >
                <CalendarDays size={16} color={T.muted} strokeWidth={2} />
                {dateRange}
              </span>
            </>
          )}
          {totalActivityCount > 0 && (
            <>
              <span
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: "50%",
                  background: "#AAB6C2",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontFamily: sans,
                  fontWeight: 500,
                  fontSize: 14.5,
                  color: T.body,
                }}
              >
                <Bookmark size={16} color={T.muted} strokeWidth={2} />
                {totalActivityCount} spot{totalActivityCount !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </div>

        {/* ── Family-fit line ── */}
        {familyFitLine && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: T.navyTint,
                borderRadius: 999,
                padding: "7px 14px 7px 9px",
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: T.navy,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkle size={12} color="#fff" strokeWidth={2.2} fill="#fff" />
              </span>
              <span
                style={{
                  fontFamily: sans,
                  fontWeight: 600,
                  fontSize: 14,
                  color: T.navy,
                  whiteSpace: "nowrap",
                }}
              >
                {familyFitLine}
              </span>
            </div>
          </div>
        )}

        {/* ── Description (generated) ── */}
        {tripDescription && (
          <p
            style={{
              fontFamily: sans,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: "25px",
              color: T.body,
              marginTop: 20,
            }}
          >
            {tripDescription}
          </p>
        )}

        {/* ── Why this fits a family ── */}
        {familyFitWhy && (
          <div
            style={{
              display: "flex",
              gap: 13,
              marginTop: 18,
              background: T.navyTint,
              borderRadius: 18,
              padding: "17px 18px",
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: T.navy,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkle size={16} color="#fff" strokeWidth={2.2} fill="#fff" />
            </span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: sans,
                  fontWeight: 700,
                  fontSize: 10.5,
                  letterSpacing: "0.7px",
                  textTransform: "uppercase",
                  color: T.navy,
                  marginBottom: 5,
                }}
              >
                Why this fits a family
              </div>
              <div
                style={{
                  fontFamily: sans,
                  fontWeight: 400,
                  fontSize: 14.5,
                  color: T.body,
                  lineHeight: "21px",
                }}
              >
                {familyFitWhy}
              </div>
            </div>
          </div>
        )}

        {/* ── The itinerary ── */}
        {dayBlocks.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <h2
              style={{
                fontFamily: display,
                fontWeight: 600,
                fontSize: 22,
                color: T.navy,
                margin: "0 0 4px",
              }}
            >
              The itinerary
            </h2>
            <p
              style={{
                fontFamily: sans,
                fontWeight: 400,
                fontSize: 14.5,
                color: T.muted,
                margin: "0 0 20px",
              }}
            >
              {dayBlocks.length} day{dayBlocks.length !== 1 ? "s" : ""}, day by day.
            </p>

            {dayBlocks.map((day) => (
              <div key={day.index} style={{ marginBottom: 26 }}>
                {/* Day header — label + date only, no theme */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 9,
                    flexWrap: "wrap",
                  }}
                >
                  <h3
                    style={{
                      fontFamily: display,
                      fontWeight: 600,
                      fontSize: 19,
                      color: T.navy,
                      margin: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {day.label}
                  </h3>
                  {day.date && (
                    <span
                      style={{
                        fontFamily: sans,
                        fontWeight: 500,
                        fontSize: 13,
                        color: T.muted,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {day.date}
                    </span>
                  )}
                </div>

                {/* Stops with dotted connector line */}
                <div style={{ position: "relative", marginTop: 14 }}>
                  <div
                    style={{
                      position: "absolute",
                      left: 15,
                      top: 8,
                      bottom: 8,
                      width: 2,
                      borderLeft: `2px dotted ${T.hair}`,
                      zIndex: 0,
                    }}
                  />
                  {day.stops.map((stop, stopIdx) => (
                    <div
                      key={stop.id}
                      style={{
                        position: "relative",
                        display: "flex",
                        gap: 15,
                        paddingBottom: 16,
                        zIndex: 1,
                      }}
                    >
                      {/* Numbered terracotta pin */}
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          backgroundColor: T.terra,
                          color: "#fff",
                          flexShrink: 0,
                          border: `3px solid ${T.paper}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: sans,
                          fontWeight: 700,
                          fontSize: 14,
                          boxShadow: "0 2px 6px rgba(196,102,74,0.35)",
                        }}
                      >
                        {stopIdx + 1}
                      </span>

                      {/* Stop details */}
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          {stop.time && (
                            <span
                              style={{
                                fontFamily: sans,
                                fontWeight: 500,
                                fontSize: 12.5,
                                color: T.muted,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {stop.time}
                            </span>
                          )}
                          {stop.time && (
                            <span
                              style={{
                                width: 3,
                                height: 3,
                                borderRadius: "50%",
                                background: "#AAB6C2",
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <span
                            style={{
                              fontFamily: sans,
                              fontWeight: 500,
                              fontSize: 12.5,
                              color: T.muted,
                            }}
                          >
                            {stop.category}
                          </span>
                        </div>
                        <div
                          style={{
                            fontFamily: sans,
                            fontWeight: 600,
                            fontSize: 16,
                            lineHeight: "20px",
                            letterSpacing: "-0.2px",
                            color: T.navy,
                            marginTop: 2,
                          }}
                        >
                          {stop.title}
                        </div>
                        {stop.familyFit && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              marginTop: 5,
                            }}
                          >
                            <Sparkle
                              size={12}
                              color={T.navy}
                              strokeWidth={2.2}
                              fill={T.navy}
                            />
                            <span
                              style={{
                                fontFamily: sans,
                                fontWeight: 600,
                                fontSize: 13,
                                color: T.navy,
                              }}
                            >
                              {stop.familyFit}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {dayBlocks.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "48px 16px",
              color: T.muted,
            }}
          >
            <p style={{ fontFamily: sans, fontSize: 15 }}>
              This trip is being planned. Check back soon.
            </p>
          </div>
        )}

        {/* ── Save this trip CTA ── */}
        <Link
          href="/sign-up"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            marginTop: 8,
            border: `1.5px solid ${T.navy}`,
            backgroundColor: T.sheet,
            color: T.navy,
            borderRadius: 999,
            padding: "13px 22px",
            textDecoration: "none",
            fontFamily: sans,
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          <CopyPlus size={17} color={T.navy} strokeWidth={2} />
          Save this trip to my Flokk
        </Link>

        {/* ── Conversion CTA panel ── */}
        <div
          style={{
            background: "linear-gradient(155deg,#234B73 0%,#1B3A5C 72%)",
            borderRadius: 26,
            padding: "clamp(26px,5vw,40px)",
            position: "relative",
            overflow: "hidden",
            marginTop: 34,
          }}
        >
          {/* Decorative circle */}
          <div
            style={{
              position: "absolute",
              right: -40,
              top: -40,
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: "rgba(196,102,74,0.18)",
            }}
          />
          <div style={{ position: "relative" }}>
            <div
              style={{
                fontFamily: sans,
                fontWeight: 700,
                fontSize: 10.5,
                letterSpacing: "0.7px",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.6)",
                marginBottom: 12,
              }}
            >
              Made for families
            </div>
            <h2
              style={{
                fontFamily: display,
                fontWeight: 600,
                fontSize: "clamp(26px,4.4vw,34px)",
                lineHeight: 1.1,
                color: "#fff",
                margin: 0,
                letterSpacing: "-0.4px",
              }}
            >
              Plan your whole trip around your family.
            </h2>
            <p
              style={{
                fontFamily: sans,
                fontWeight: 400,
                fontSize: 15.5,
                color: "rgba(255,255,255,0.82)",
                margin: "14px 0 0",
                maxWidth: 480,
              }}
            >
              Flokk keeps every place you save in one spot and turns it into a
              trip that actually fits your kids.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
                margin: "26px 0 28px",
              }}
            >
              {CTA_PROPS.map((p) => (
                <div key={p.title}>
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      background: "rgba(255,255,255,0.12)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 10,
                    }}
                  >
                    {p.icon}
                  </span>
                  <div
                    style={{
                      fontFamily: sans,
                      fontWeight: 600,
                      fontSize: 15,
                      lineHeight: "20px",
                      color: "#fff",
                    }}
                  >
                    {p.title}
                  </div>
                  <div
                    style={{
                      fontFamily: sans,
                      fontWeight: 400,
                      fontSize: 13.5,
                      color: "rgba(255,255,255,0.72)",
                      marginTop: 4,
                    }}
                  >
                    {p.body}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 14,
              }}
            >
              <Link
                href="/sign-up"
                style={{
                  backgroundColor: T.terra,
                  color: "#fff",
                  borderRadius: 999,
                  padding: "14px 24px",
                  fontFamily: sans,
                  fontWeight: 600,
                  fontSize: 15.5,
                  whiteSpace: "nowrap",
                  boxShadow: "0 8px 20px rgba(196,102,74,0.4)",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                Start planning, it is free
              </Link>
              <Link
                href="/about"
                style={{
                  backgroundColor: "transparent",
                  color: "#fff",
                  fontFamily: sans,
                  fontWeight: 600,
                  fontSize: 14.5,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  opacity: 0.9,
                  textDecoration: "none",
                }}
              >
                See how Flokk works{" "}
                <ArrowRight size={16} color="#fff" strokeWidth={2.2} />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            borderTop: `1px solid ${T.hair2}`,
            marginTop: 40,
            paddingTop: 22,
            paddingBottom: 8,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: display,
                fontWeight: 700,
                fontSize: 17,
                color: T.navy,
              }}
            >
              Flokk
            </span>
            <span
              style={{
                fontFamily: sans,
                fontWeight: 500,
                fontSize: 12.5,
                color: T.muted,
              }}
            >
              Family travel, in one place.
            </span>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            {[
              { label: "How it works", href: "/about" },
              { label: "Privacy", href: "/privacy" },
              { label: "About", href: "/about" },
            ].map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                style={{
                  fontFamily: sans,
                  fontWeight: 500,
                  fontSize: 13,
                  color: T.muted,
                  textDecoration: "none",
                }}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

      </div>{/* end 760px content */}

      {/* ── Bottom bar (owner / steal, unchanged) ── */}
      <SharePageBottomBar
        tripId={trip.id}
        isOwner={isOwner}
        shareToken={token}
        tripDestination={tripDestination}
        totalActivityCount={totalActivityCount}
      />
    </div>
  );
}
