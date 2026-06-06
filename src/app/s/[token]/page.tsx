import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveShareToken } from "@/lib/share-token";
import { getTripCoverImage } from "@/lib/destination-images";
import {
  Bird, MapPin, CalendarDays, Route, Bookmark,
  Sparkle, Sparkles, CopyPlus, UsersRound, ArrowRight,
  Navigation, Building2, PlaneTakeoff, Train as TrainIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

// ── Design tokens ─────────────────────────────────────────────────────────────
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

// ── Family-fit tag map ────────────────────────────────────────────────────────
const TAG_FIT_MAP: Array<{ pattern: RegExp; line: string; why: string }> = [
  { pattern: /beach|ocean|snorkel|swim|surf|water park/i,        line: "Perfect for water-loving families",  why: "This is packed with water activities - beaches, snorkeling, and swim spots that kids of all ages tend to love." },
  { pattern: /museum|history|heritage|ruins|culture|monument|palace/i, line: "Educational and hands-on",   why: "History and culture woven throughout - the kind of thing families talk about long after they are home." },
  { pattern: /theme park|amusement|roller|entertainment|show|performance/i, line: "Built for family fun",  why: "Kid-focused entertainment and shows that work across age groups, so everyone stays in the game." },
  { pattern: /food|restaurant|cuisine|market|dining|street food/i, line: "A foodie family's dream",       why: "Built around local flavours - ideal for families who explore a new place through what they eat." },
  { pattern: /hike|trek|outdoor|nature|national park|wildlife|safari/i, line: "Great for active families", why: "Outdoor adventure and nature experiences that keep everyone moving and engaged." },
  { pattern: /zoo|aquarium|animal/i,                              line: "Animals around every corner",      why: "Animal encounters throughout - from zoos to wildlife sanctuaries - make for memorable family moments." },
  { pattern: /kids|family|playground|toddler|child/i,            line: "Designed with kids in mind",       why: "Every stop chosen by a family with kids - the pace and the picks are already dialed in." },
];

function deriveFamilyFitLine(tags: string[]): string | null {
  const s = tags.join(" ");
  for (const { pattern, line } of TAG_FIT_MAP) if (pattern.test(s)) return line;
  return null;
}
function deriveFamilyFitWhy(tags: string[]): string | null {
  const s = tags.join(" ");
  for (const { pattern, why } of TAG_FIT_MAP) if (pattern.test(s)) return why;
  return null;
}

// ── Category helpers ──────────────────────────────────────────────────────────
function savedItemCategoryLabel(tags: string[]): string {
  const t = tags.join(" ").toLowerCase();
  if (/lodging|accommodation|hotel|stay/.test(t))            return "Stay";
  if (/restaurant|food|dining|cuisine|bar|cafe|coffee/.test(t)) return "Restaurant";
  if (/adventure|thrill|sport/.test(t))                      return "Adventure";
  if (/culture|museum|history|heritage|art|gallery/.test(t)) return "Culture";
  if (/nature|outdoors|park|beach|ocean|hike|wildlife/.test(t)) return "Outdoors";
  if (/zoo|aquarium|kids|family|playground|child/.test(t))   return "Kids pick";
  if (/theme park|entertainment|show|performance/.test(t))   return "Experience";
  return "Saved place";
}

function extractCityName(city: string, country: string | null): string {
  if (!country) return city;
  const suffix = `, ${country}`;
  return city.toLowerCase().endsWith(suffix.toLowerCase())
    ? city.slice(0, -suffix.length).trim()
    : city;
}

function formatTourLocation(city: string, country: string | null): string {
  if (!country) return city;
  if (city.toLowerCase().endsWith(`, ${country.toLowerCase()}`)) return city;
  return `${city}, ${country}`;
}

const ITIN_CATEGORY: Record<string, string> = {
  FLIGHT: "Flight", TRAIN: "Train", LODGING: "Stay", ACTIVITY: "Activity",
};

// ── Tour stop type ────────────────────────────────────────────────────────────
type TourStopItem = {
  id: string; orderIndex: number; name: string; address: string | null;
  durationMin: number | null; travelTimeMin: number | null;
  why: string | null; familyNote: string | null;
  publicWhy: string | null; publicFamilyNote: string | null;
  websiteUrl: string | null; ticketRequired: string | null;
};

// ── Conversion panel value props ──────────────────────────────────────────────
const CTA_PROPS = [
  { title: "Save from anywhere",   body: "Instagram, TikTok, Maps, a screenshot. It all lands in one place." },
  { title: "Built around your kids", body: "Ages, allergies and pace woven into every plan." },
  { title: "A family-ready trip",  body: "Turn a pile of saves into a day-by-day itinerary." },
];

// ── generateMetadata ──────────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const entity = await resolveShareToken(token);
  if (!entity) return { title: "Place | Flokk" };

  let title = "Place | Flokk";
  let description = "Shared on Flokk, the family travel app.";
  let imageUrl: string | null = null;

  if (entity.entityType === "saved_item" && entity.savedItem) {
    const item = entity.savedItem;
    const catLabel = savedItemCategoryLabel(item.categoryTags);
    const city = item.destinationCity;
    title = city ? `${item.rawTitle ?? "Place"} in ${city} | Flokk` : `${item.rawTitle ?? "Place"} | Flokk`;
    description = item.rawDescription
      ? item.rawDescription.slice(0, 160)
      : city ? `${catLabel} in ${city}, saved on Flokk.` : `${catLabel} saved on Flokk.`;
    imageUrl = item.placePhotoUrl ?? item.mediaThumbnailUrl;
    if (!imageUrl && city) imageUrl = getTripCoverImage(city, item.destinationCountry);
  } else if (entity.entityType === "itinerary_item" && entity.itineraryItem) {
    const item = entity.itineraryItem;
    const city = item.trip?.destinationCity;
    title = `${item.title} | Flokk`;
    description = city ? `From a family trip to ${city}, shared on Flokk.` : "Shared on Flokk.";
    imageUrl = item.parallelSavedItem?.placePhotoUrl ?? null;
    if (!imageUrl && city) imageUrl = getTripCoverImage(city, null);
  } else if (entity.entityType === "manual_activity" && entity.manualActivity) {
    const item = entity.manualActivity;
    title = `${item.title} | Flokk`;
    description = item.city ? `Activity in ${item.city}, shared on Flokk.` : "Shared on Flokk.";
    imageUrl = item.imageUrl ?? (item.city ? getTripCoverImage(item.city, null) : null);
  } else if (entity.entityType === "generated_tour" && entity.generatedTour) {
    const tour = entity.generatedTour;
    const cityName = extractCityName(tour.destinationCity, tour.destinationCountry);
    const loc = formatTourLocation(tour.destinationCity, tour.destinationCountry);
    title = `${tour.publicTitle ?? tour.title} - ${loc} | Flokk`;
    description = tour.publicSubtitle ?? tour.subtitle ?? `A family-ready tour of ${loc}.`;
    imageUrl = getTripCoverImage(cityName, tour.destinationCountry);
  }

  const absoluteImg = imageUrl
    ? imageUrl.startsWith("http") ? imageUrl : `https://flokktravel.com${imageUrl}`
    : null;

  return {
    title,
    description,
    ...(absoluteImg && {
      openGraph: { title, description, images: [{ url: absoluteImg, width: 1200, height: 630 }] },
      twitter: { card: "summary_large_image", title, description, images: [absoluteImg] },
    }),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function ShareItemPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const entity = await resolveShareToken(token);
  if (!entity) notFound();

  // ── Build view model ─────────────────────────────────────────────────────
  let headline = "";
  let kicker = "";
  let kickerIcon = <Bookmark size={12} color="#fff" strokeWidth={2.2} />;
  let heroImg = "";
  let locationLine: string | null = null;
  let timeLine: string | null = null;
  let tourMeta: string | null = null;
  let fitLine: string | null = null;
  let fitWhy: string | null = null;
  let description: string | null = null;
  let venueUrl: string | null = null;
  let isTransit = false;
  let tourStops: TourStopItem[] | null = null;
  let walkingWarning = false;

  if (entity.entityType === "saved_item" && entity.savedItem) {
    const item = entity.savedItem;
    const catLabel = savedItemCategoryLabel(item.categoryTags);
    headline   = item.rawTitle ?? "Place";
    kicker     = catLabel;
    kickerIcon = <Bookmark size={12} color="#fff" strokeWidth={2.2} />;
    heroImg    = item.placePhotoUrl ?? item.mediaThumbnailUrl
      ?? (item.destinationCity ? getTripCoverImage(item.destinationCity, item.destinationCountry) : "");
    locationLine = [item.destinationCity, item.destinationCountry].filter(Boolean).join(", ") || null;
    fitLine    = deriveFamilyFitLine(item.categoryTags);
    fitWhy     = deriveFamilyFitWhy(item.categoryTags);
    description = item.rawDescription || null;
    venueUrl   = item.websiteUrl;
    // Privacy: userRating, userNote, trip attribution → never rendered

  } else if (entity.entityType === "itinerary_item" && entity.itineraryItem) {
    const item = entity.itineraryItem;
    const ps   = item.parallelSavedItem;
    isTransit  = item.type === "FLIGHT" || item.type === "TRAIN";
    kicker     = ITIN_CATEGORY[item.type] ?? "Activity";
    kickerIcon = item.type === "FLIGHT"  ? <PlaneTakeoff size={12} color="#fff" strokeWidth={2.2} />
               : item.type === "TRAIN"   ? <TrainIcon    size={12} color="#fff" strokeWidth={2.2} />
               : item.type === "LODGING" ? <Building2    size={12} color="#fff" strokeWidth={2.2} />
               :                           <MapPin       size={12} color="#fff" strokeWidth={2.2} />;

    if ((item.type === "FLIGHT" || item.type === "TRAIN") && item.fromAirport && item.toAirport) {
      headline = `${item.fromAirport} - ${item.toAirport}`;
    } else if ((item.type === "FLIGHT" || item.type === "TRAIN") && item.fromCity && item.toCity) {
      headline = `${item.fromCity} - ${item.toCity}`;
    } else if (item.type === "LODGING") {
      headline = item.title.replace(/^check-in:\s*/i, "");
    } else {
      headline = item.title;
    }

    const city = item.trip?.destinationCity;
    heroImg    = ps?.placePhotoUrl ?? (city ? getTripCoverImage(city, null) : "");
    locationLine = item.address ?? (isTransit ? (item.toCity ?? null) : null);

    if (item.departureTime && item.arrivalTime) {
      timeLine = `${item.departureTime} - ${item.arrivalTime}`;
    } else if (item.departureTime) {
      timeLine = item.departureTime;
    } else if (item.arrivalTime) {
      timeLine = item.arrivalTime;
    } else if (item.scheduledDate) {
      timeLine = new Date(item.scheduledDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }

    fitLine     = ps ? deriveFamilyFitLine(ps.categoryTags) : null;
    fitWhy      = ps ? deriveFamilyFitWhy(ps.categoryTags)  : null;
    description = ps?.rawDescription ?? null;
    venueUrl    = item.venueUrl;
    // Privacy: confirmationCode, notes, parallelSavedItem.userRating → never rendered

  } else if (entity.entityType === "manual_activity" && entity.manualActivity) {
    const item = entity.manualActivity;
    isTransit  = item.type === "FLIGHT" || item.type === "TRAIN";
    kicker     = (item.type && ITIN_CATEGORY[item.type]) ? ITIN_CATEGORY[item.type] : "Activity";
    kickerIcon = <MapPin size={12} color="#fff" strokeWidth={2.2} />;
    headline   = item.title;
    heroImg    = item.imageUrl ?? (item.city ? getTripCoverImage(item.city, null) : "");
    locationLine = item.venueName ?? item.address ?? item.city ?? null;
    timeLine   = item.time
      ?? new Date(item.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    venueUrl   = item.website;
    // Privacy: confirmationCode, notes, price → never rendered

  } else if (entity.entityType === "generated_tour" && entity.generatedTour) {
    const tour = entity.generatedTour;
    const cityName = extractCityName(tour.destinationCity, tour.destinationCountry);
    headline   = tour.publicTitle ?? tour.title;
    kicker     = "Tour";
    kickerIcon = <Route size={12} color="#fff" strokeWidth={2.2} />;
    heroImg    = getTripCoverImage(cityName, tour.destinationCountry);
    locationLine = formatTourLocation(tour.destinationCity, tour.destinationCountry);
    tourMeta   = [tour.durationLabel, tour.transport, `${tour.stops.length} stop${tour.stops.length !== 1 ? "s" : ""}`]
      .filter(Boolean).join(" · ");
    fitLine    = deriveFamilyFitLine(tour.categoryTags);
    fitWhy     = deriveFamilyFitWhy(tour.categoryTags);
    description = tour.publicSubtitle ?? tour.subtitle ?? null;
    tourStops  = tour.stops;
    walkingWarning = /walk/i.test(tour.transport) && tour.stops.some(s => (s.travelTimeMin ?? 0) > 20);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.paper, paddingBottom: "120px" }}>

      {/* ── Sticky brand top bar ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 30,
        background: "rgba(250,247,242,0.86)",
        backdropFilter: "blur(14px) saturate(150%)",
        WebkitBackdropFilter: "blur(14px) saturate(150%)",
        borderBottom: `1px solid ${T.hair2}`,
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: T.navy, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Bird size={18} color="#fff" strokeWidth={2} />
            </span>
            <span style={{ fontFamily: display, fontWeight: 700, fontSize: 22, color: T.navy, letterSpacing: "-0.3px" }}>
              Flokk
            </span>
          </div>
          <Link href="/sign-up" style={{ backgroundColor: T.terra, color: "#fff", borderRadius: 999, padding: "9px 16px", fontFamily: sans, fontWeight: 600, fontSize: 13.5, textDecoration: "none", whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(196,102,74,0.28)", display: "inline-block" }}>
            Plan your trip
          </Link>
        </div>
      </header>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 48px" }}>

        {/* ── Hero ── */}
        {heroImg && (
          <div style={{
            position: "relative", borderRadius: 22, overflow: "hidden",
            height: "clamp(200px, 38vw, 320px)",
            background: "linear-gradient(140deg,#D9CFBE,#BFB199)",
            backgroundImage: `url('${heroImg}')`,
            backgroundSize: "cover", backgroundPosition: "center",
            boxShadow: "0 2px 10px rgba(27,58,92,0.07), 0 1px 2px rgba(27,58,92,0.04)",
          }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.45) 100%)" }} />
            <span style={{
              position: "absolute", top: 14, left: 14, zIndex: 2,
              display: "inline-flex", alignItems: "center", gap: 6,
              backgroundColor: T.terra, color: "#fff", borderRadius: 999,
              padding: "6px 12px", fontFamily: sans, fontWeight: 700,
              fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase",
              whiteSpace: "nowrap", boxShadow: "0 3px 10px rgba(196,102,74,0.4)",
            }}>
              {kickerIcon}
              {kicker}
            </span>
          </div>
        )}

        {/* ── Kicker + headline ── */}
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 10.5, letterSpacing: "0.7px", textTransform: "uppercase", color: T.terraDeep, marginTop: heroImg ? 22 : 0 }}>
          Shared on Flokk
        </div>
        <h1 style={{ fontFamily: display, fontWeight: 600, fontSize: "clamp(26px,5vw,38px)", lineHeight: 1.08, color: T.navy, margin: "10px 0 0", letterSpacing: "-0.5px" }}>
          {headline}
        </h1>

        {/* ── Location / time / tour-meta row ── */}
        {(locationLine || timeLine || tourMeta) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {locationLine && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: sans, fontWeight: 500, fontSize: 14.5, color: T.body }}>
                <MapPin size={16} color={T.muted} strokeWidth={2} />
                {locationLine}
              </span>
            )}
            {timeLine && (
              <>
                {locationLine && <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#AAB6C2", flexShrink: 0 }} />}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: sans, fontWeight: 500, fontSize: 14.5, color: T.body }}>
                  <CalendarDays size={16} color={T.muted} strokeWidth={2} />
                  {timeLine}
                </span>
              </>
            )}
            {tourMeta && (
              <>
                {locationLine && <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#AAB6C2", flexShrink: 0 }} />}
                <span style={{ fontFamily: sans, fontWeight: 500, fontSize: 14.5, color: T.body }}>
                  {tourMeta}
                </span>
              </>
            )}
          </div>
        )}

        {/* ── Family-fit pill ── */}
        {fitLine && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: T.navyTint, borderRadius: 999, padding: "7px 14px 7px 9px" }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: T.navy, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkle size={12} color="#fff" strokeWidth={2.2} fill="#fff" />
              </span>
              <span style={{ fontFamily: sans, fontWeight: 600, fontSize: 14, color: T.navy, whiteSpace: "nowrap" }}>
                {fitLine}
              </span>
            </div>
          </div>
        )}

        {/* ── Description ── */}
        {description && (
          <p style={{ fontFamily: sans, fontWeight: 400, fontSize: 16, lineHeight: "25px", color: T.body, marginTop: 20 }}>
            {description}
          </p>
        )}

        {/* ── Why this fits a family ── */}
        {fitWhy && (
          <div style={{ display: "flex", gap: 13, marginTop: 18, background: T.navyTint, borderRadius: 18, padding: "17px 18px" }}>
            <span style={{ width: 34, height: 34, borderRadius: "50%", background: T.navy, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkle size={16} color="#fff" strokeWidth={2.2} fill="#fff" />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 10.5, letterSpacing: "0.7px", textTransform: "uppercase", color: T.navy, marginBottom: 5 }}>
                Why this fits a family
              </div>
              <div style={{ fontFamily: sans, fontWeight: 400, fontSize: 14.5, color: T.body, lineHeight: "21px" }}>
                {fitWhy}
              </div>
            </div>
          </div>
        )}

        {/* ── Walking warning (tours only) ── */}
        {walkingWarning && (
          <div style={{ display: "flex", gap: 11, marginTop: 18, background: "rgba(196,102,74,0.08)", borderRadius: 14, padding: "14px 16px", border: "1px solid rgba(196,102,74,0.2)" }}>
            <div style={{ flexShrink: 0, marginTop: 1 }}>
              <Navigation size={18} color={T.terra} strokeWidth={2} />
            </div>
            <div style={{ fontFamily: sans, fontSize: 14, color: T.body, lineHeight: "20px" }}>
              <strong style={{ color: T.terraDeep }}>Heads up:</strong> Some legs on this tour cover more ground. Good walking shoes recommended.
            </div>
          </div>
        )}

        {/* ── Tour stops ── */}
        {tourStops && tourStops.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <h2 style={{ fontFamily: display, fontWeight: 600, fontSize: 22, color: T.navy, margin: "0 0 4px" }}>
              The route
            </h2>
            <p style={{ fontFamily: sans, fontWeight: 400, fontSize: 14.5, color: T.muted, margin: "0 0 20px" }}>
              {tourStops.length} stop{tourStops.length !== 1 ? "s" : ""}, in order.
            </p>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 15, top: 8, bottom: 8, width: 2, borderLeft: `2px dotted ${T.hair}`, zIndex: 0 }} />
              {tourStops.map((stop, idx) => {
                const stopWhy  = stop.publicWhy  ?? stop.why  ?? null;
                // familyNote only renders when the family actually entered it in the tour builder — never auto-asserted
                const stopNote = stop.publicFamilyNote ?? stop.familyNote ?? null;
                const isLast   = idx === tourStops!.length - 1;
                return (
                  <div key={stop.id} style={{ position: "relative", display: "flex", gap: 15, paddingBottom: 20, zIndex: 1 }}>
                    <span style={{
                      width: 32, height: 32, borderRadius: "50%",
                      backgroundColor: T.terra, color: "#fff", flexShrink: 0,
                      border: `3px solid ${T.paper}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: sans, fontWeight: 700, fontSize: 14,
                      boxShadow: "0 2px 6px rgba(196,102,74,0.35)",
                    }}>
                      {idx + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                      {(stop.durationMin || stop.ticketRequired) && (
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          {stop.durationMin && (
                            <span style={{ fontFamily: sans, fontWeight: 500, fontSize: 12.5, color: T.muted }}>
                              {stop.durationMin >= 60
                                ? `${Math.floor(stop.durationMin / 60)}h${stop.durationMin % 60 ? ` ${stop.durationMin % 60}m` : ""}`
                                : `${stop.durationMin}m`}
                            </span>
                          )}
                          {stop.durationMin && stop.ticketRequired && (
                            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#AAB6C2", flexShrink: 0 }} />
                          )}
                          {stop.ticketRequired && (
                            <span style={{ fontFamily: sans, fontWeight: 500, fontSize: 12.5, color: T.muted }}>
                              {stop.ticketRequired}
                            </span>
                          )}
                        </div>
                      )}
                      <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 16, lineHeight: "20px", letterSpacing: "-0.2px", color: T.navy, marginTop: 3 }}>
                        {stop.name}
                      </div>
                      {stop.address && (
                        <div style={{ fontFamily: sans, fontSize: 13, color: T.muted, marginTop: 2 }}>
                          {stop.address}
                        </div>
                      )}
                      {stopWhy && (
                        <p style={{ fontFamily: sans, fontSize: 14, color: T.body, lineHeight: "20px", margin: "6px 0 0" }}>
                          {stopWhy}
                        </p>
                      )}
                      {stopNote && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                          <Sparkle size={12} color={T.navy} strokeWidth={2.2} fill={T.navy} />
                          <span style={{ fontFamily: sans, fontWeight: 600, fontSize: 13, color: T.navy }}>
                            {stopNote}
                          </span>
                        </span>
                      )}
                      {!isLast && stop.travelTimeMin && (
                        <div style={{ marginTop: 10, fontFamily: sans, fontSize: 12.5, color: T.muted, display: "flex", alignItems: "center", gap: 5 }}>
                          <Navigation size={12} color={T.muted} strokeWidth={2} />
                          {stop.travelTimeMin >= 60
                            ? `${Math.floor(stop.travelTimeMin / 60)}h ${stop.travelTimeMin % 60}m to next stop`
                            : `${stop.travelTimeMin} min to next stop`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Venue link (single items only, not tours, not transit) ── */}
        {venueUrl && !isTransit && !tourStops && (
          <div style={{ marginTop: 24 }}>
            <a href={venueUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: sans, fontWeight: 600, fontSize: 15, color: T.navy, border: `1.5px solid ${T.hair}`, borderRadius: 999, padding: "11px 20px", textDecoration: "none", background: T.sheet }}>
              <MapPin size={16} color={T.navy} strokeWidth={2} />
              View on the web
            </a>
          </div>
        )}

        {/* ── Save CTA (not shown for FLIGHT or TRAIN) ── */}
        {!isTransit && (
          <Link href="/sign-up" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, marginTop: tourStops ? 8 : 28, border: `1.5px solid ${T.navy}`, backgroundColor: T.sheet, color: T.navy, borderRadius: 999, padding: "13px 22px", textDecoration: "none", fontFamily: sans, fontWeight: 600, fontSize: 15 }}>
            <CopyPlus size={17} color={T.navy} strokeWidth={2} />
            {tourStops ? "Save this tour to my Flokk" : "Save this to my Flokk"}
          </Link>
        )}

        {/* ── Conversion panel ── */}
        <div style={{ background: "linear-gradient(155deg,#234B73 0%,#1B3A5C 72%)", borderRadius: 26, padding: "clamp(26px,5vw,40px)", position: "relative", overflow: "hidden", marginTop: 34 }}>
          <div style={{ position: "absolute", right: -40, top: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(196,102,74,0.18)" }} />
          <div style={{ position: "relative" }}>
            <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 10.5, letterSpacing: "0.7px", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 12 }}>
              Made for families
            </div>
            <h2 style={{ fontFamily: display, fontWeight: 600, fontSize: "clamp(26px,4.4vw,34px)", lineHeight: 1.1, color: "#fff", margin: 0, letterSpacing: "-0.4px" }}>
              Plan your whole trip around your family.
            </h2>
            <p style={{ fontFamily: sans, fontWeight: 400, fontSize: 15.5, color: "rgba(255,255,255,0.82)", margin: "14px 0 0", maxWidth: 480 }}>
              Flokk keeps every place you save in one spot and turns it into a trip that actually fits your kids.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, margin: "26px 0 28px" }}>
              {CTA_PROPS.map((p) => (
                <div key={p.title}>
                  <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 15, lineHeight: "20px", color: "#fff" }}>{p.title}</div>
                  <div style={{ fontFamily: sans, fontWeight: 400, fontSize: 13.5, color: "rgba(255,255,255,0.72)", marginTop: 4 }}>{p.body}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
              <Link href="/sign-up" style={{ backgroundColor: T.terra, color: "#fff", borderRadius: 999, padding: "14px 24px", fontFamily: sans, fontWeight: 600, fontSize: 15.5, whiteSpace: "nowrap", boxShadow: "0 8px 20px rgba(196,102,74,0.4)", textDecoration: "none", display: "inline-block" }}>
                Start planning, it is free
              </Link>
              <Link href="/about" style={{ backgroundColor: "transparent", color: "#fff", fontFamily: sans, fontWeight: 600, fontSize: 14.5, display: "inline-flex", alignItems: "center", gap: 6, opacity: 0.9, textDecoration: "none" }}>
                See how Flokk works <ArrowRight size={16} color="#fff" strokeWidth={2.2} />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ borderTop: `1px solid ${T.hair2}`, marginTop: 40, paddingTop: 22, paddingBottom: 8, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: display, fontWeight: 700, fontSize: 17, color: T.navy }}>Flokk</span>
            <span style={{ fontFamily: sans, fontWeight: 500, fontSize: 12.5, color: T.muted }}>Family travel, in one place.</span>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            {[{ label: "How it works", href: "/about" }, { label: "Privacy", href: "/privacy" }, { label: "About", href: "/about" }].map(({ label, href }) => (
              <Link key={label} href={href} style={{ fontFamily: sans, fontWeight: 500, fontSize: 13, color: T.muted, textDecoration: "none" }}>
                {label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
