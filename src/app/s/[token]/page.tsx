import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { resolveShareToken, type ResolvedShareEntity } from "@/lib/share-token";
import { ShareItemView } from "@/components/share/ShareItemView";
import { TourShareView } from "@/components/share/TourShareView";
import { AppHeader } from "@/components/ui/AppHeader";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { BottomNav } from "@/components/ui/BottomNav";
import { db } from "@/lib/db";
import { getTripCoverImage } from "@/lib/destination-images";

export const dynamic = "force-dynamic";

function extractCityName(destinationCity: string, destinationCountry: string | null): string {
  if (!destinationCountry) return destinationCity;
  const suffix = `, ${destinationCountry}`;
  return destinationCity.toLowerCase().endsWith(suffix.toLowerCase())
    ? destinationCity.slice(0, -suffix.length).trim()
    : destinationCity;
}

function formatTourLocation(city: string, country: string | null): string {
  if (!country) return city;
  if (city.toLowerCase().endsWith(`, ${country.toLowerCase()}`)) return city;
  return `${city}, ${country}`;
}

const OG_FALLBACK_DESC = "A pick shared on Flokk.";

function truncateDesc(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return null;
  return t.length > 160 ? `${t.slice(0, 157)}...` : t;
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const entity = await resolveShareToken(token);
  if (!entity) return { title: "Place | Flokk" };

  // Build title + the og:image inputs (a photo, a city/country for the destination fallback, and a
  // public blurb) per entity type from the entity already fetched above — no extra query.
  let title = "Place | Flokk";
  let photo: string | null = null;
  let city: string | null = null;
  let country: string | null = null;
  let blurb: string | null = null;

  if (entity.entityType === "saved_item" && entity.savedItem) {
    const s = entity.savedItem;
    title = s.destinationCity
      ? `${s.rawTitle ?? "Place"} in ${s.destinationCity} | Flokk`
      : `${s.rawTitle ?? "Place"} | Flokk`;
    photo = s.placePhotoUrl ?? s.mediaThumbnailUrl ?? null;
    city = s.destinationCity;
    country = s.destinationCountry;
    blurb = s.rawDescription;
  } else if (entity.entityType === "itinerary_item" && entity.itineraryItem) {
    const it = entity.itineraryItem;
    title = `${it.title} | Flokk`;
    photo = it.parallelSavedItem?.placePhotoUrl ?? null;
    city = it.parallelSavedItem?.destinationCity ?? it.trip?.destinationCity ?? it.toCity ?? null;
    country = it.parallelSavedItem?.destinationCountry ?? null;
    blurb = it.parallelSavedItem?.rawDescription ?? null;
  } else if (entity.entityType === "manual_activity" && entity.manualActivity) {
    const m = entity.manualActivity;
    title = `${m.title} | Flokk`;
    photo = m.imageUrl ?? null;
    city = m.city ?? m.trip?.destinationCity ?? null;
    // manual activities have no public blurb (notes are private) — generic description below.
    blurb = null;
  } else if (entity.entityType === "generated_tour" && entity.generatedTour) {
    const t = entity.generatedTour;
    const loc = formatTourLocation(t.destinationCity, t.destinationCountry);
    title = `${t.publicTitle ?? t.title} · ${loc} | Flokk`;
    photo = t.stops.find((st) => st.imageUrl)?.imageUrl ?? null;
    city = extractCityName(t.destinationCity, t.destinationCountry);
    country = t.destinationCountry;
    blurb = t.publicSubtitle ?? t.stops.find((st) => st.publicWhy)?.publicWhy ?? null;
  }

  // Image priority: the entity's own photo -> the place/destination cover -> branded Flokk
  // default. getTripCoverImage applies that exact chain (heroImageUrl arg, then destination
  // lookup, then DEFAULT_COVER) — same helper the trip share page uses.
  const heroImg = getTripCoverImage(city, country, photo);
  const absoluteImg = heroImg.startsWith("http") ? heroImg : `https://flokktravel.com${heroImg}`;
  const description = truncateDesc(blurb) ?? OG_FALLBACK_DESC;
  const alt = title.replace(" | Flokk", "");

  return {
    title,
    openGraph: {
      title,
      description,
      type: "website" as const,
      images: [{ url: absoluteImg, width: 1200, height: 630, alt }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: [absoluteImg],
    },
  };
}

export default async function ShareItemPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const entity = await resolveShareToken(token);
  if (!entity) notFound();

  const { userId } = await auth();
  const isSignedIn = !!userId;

  if (entity.entityType === "generated_tour" && entity.generatedTour) {
    const tour = entity.generatedTour;
    const cityName = extractCityName(tour.destinationCity, tour.destinationCountry);
    const locationDisplay = formatTourLocation(tour.destinationCity, tour.destinationCountry);

    const geoCity = await db.city.findFirst({
      where: { name: { equals: cityName, mode: "insensitive" } },
      select: {
        slug: true,
        name: true,
        country: {
          select: {
            slug: true,
            name: true,
            continent: { select: { slug: true, name: true } },
          },
        },
      },
    });

    const heroImageUrl = getTripCoverImage(cityName, tour.destinationCountry);

    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "80px" }}>
        <AppHeader />

        {/* Back bar */}
        <div
          style={{
            backgroundColor: "#fff",
            borderBottom: "1px solid #EEEEEE",
            padding: "0 24px",
            minHeight: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <Link
            href={geoCity ? `/cities/${geoCity.slug}` : "/discover"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#C4664A",
              textDecoration: "none",
            }}
          >
            ← Back to {geoCity ? geoCity.name : "Destinations"}
          </Link>
          {geoCity && (
            <nav
              aria-label="Breadcrumb"
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "2px",
                fontSize: "12px",
                color: "#717171",
              }}
            >
              <Link href="/discover" style={{ color: "inherit", textDecoration: "none" }}>
                Destinations
              </Link>
              <span style={{ opacity: 0.6, padding: "0 3px" }}>›</span>
              <Link
                href={`/continents/${geoCity.country.continent.slug}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {geoCity.country.continent.name}
              </Link>
              <span style={{ opacity: 0.6, padding: "0 3px" }}>›</span>
              <Link
                href={`/countries/${geoCity.country.slug}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {geoCity.country.name}
              </Link>
            </nav>
          )}
        </div>

        {/* Hero */}
        <div
          style={{
            height: "220px",
            position: "relative",
            overflow: "hidden",
            backgroundColor: "#1B3A5C",
            backgroundImage: `url('${heroImageUrl}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.78) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              left: "24px",
              right: "24px",
              zIndex: 2,
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "rgba(255,255,255,0.7)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Tour
            </span>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 900,
                color: "#fff",
                lineHeight: 1.1,
                marginBottom: "4px",
                marginTop: "4px",
                textShadow: "0 2px 12px rgba(0,0,0,0.4)",
              }}
            >
              {tour.publicTitle ?? tour.title}
            </h1>
            {tour.publicSubtitle && (
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", margin: "0 0 4px" }}>
                {tour.publicSubtitle}
              </p>
            )}
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", margin: 0 }}>
              {locationDisplay} · {tour.durationLabel} · {tour.transport}
            </p>
          </div>
        </div>

        {/* Map + stops + CTA */}
        <TourShareView stops={tour.stops} transport={tour.transport} isSignedIn={isSignedIn} token={token} />

        <div className="hidden md:block">
          <SiteFooter />
        </div>
        <BottomNav />
      </div>
    );
  }

  // Build a sanitized entity before passing to the client component.
  // Every field not rendered publicly is set to null here so it never
  // enters the RSC payload. Do not rely on the client component hiding fields.
  let sanitizedEntity: ResolvedShareEntity;

  if (entity.entityType === "saved_item" && entity.savedItem) {
    const s = entity.savedItem;
    sanitizedEntity = {
      entityType: "saved_item",
      savedItem: {
        id: s.id,
        rawTitle: s.rawTitle,
        rawDescription: s.rawDescription,
        placePhotoUrl: s.placePhotoUrl,
        mediaThumbnailUrl: s.mediaThumbnailUrl,
        websiteUrl: s.websiteUrl,
        destinationCity: s.destinationCity,
        destinationCountry: s.destinationCountry,
        lat: null,
        lng: null,
        categoryTags: s.categoryTags,
        userRating: null,
        userNote: null,
        sourcePlatform: s.sourcePlatform,
        sourceMethod: null,
        sourceUrl: s.sourceUrl,
        savedAt: s.savedAt,
        shareToken: s.shareToken,
        trip: s.trip,
      },
    };
  } else if (entity.entityType === "itinerary_item" && entity.itineraryItem) {
    const it = entity.itineraryItem;
    sanitizedEntity = {
      entityType: "itinerary_item",
      itineraryItem: {
        id: it.id,
        type: it.type,
        title: it.title,
        scheduledDate: it.scheduledDate,
        departureTime: it.departureTime,
        arrivalTime: it.arrivalTime,
        fromAirport: it.fromAirport,
        toAirport: it.toAirport,
        fromCity: it.fromCity,
        toCity: it.toCity,
        confirmationCode: null,
        notes: null,
        address: it.address,
        totalCost: null,
        currency: null,
        latitude: it.latitude,
        longitude: it.longitude,
        venueUrl: it.venueUrl,
        shareToken: it.shareToken,
        trip: it.trip,
        parallelSavedItem: it.parallelSavedItem
          ? {
              id: it.parallelSavedItem.id,
              rawTitle: it.parallelSavedItem.rawTitle,
              rawDescription: it.parallelSavedItem.rawDescription,
              placePhotoUrl: it.parallelSavedItem.placePhotoUrl,
              websiteUrl: it.parallelSavedItem.websiteUrl,
              destinationCity: it.parallelSavedItem.destinationCity,
              destinationCountry: it.parallelSavedItem.destinationCountry,
              categoryTags: it.parallelSavedItem.categoryTags,
              userRating: null,
            }
          : null,
      },
    };
  } else if (entity.entityType === "manual_activity" && entity.manualActivity) {
    const ma = entity.manualActivity;
    sanitizedEntity = {
      entityType: "manual_activity",
      manualActivity: {
        id: ma.id,
        title: ma.title,
        date: ma.date,
        time: ma.time,
        endTime: ma.endTime,
        venueName: ma.venueName,
        address: ma.address,
        lat: null,
        lng: null,
        website: ma.website,
        price: null,
        currency: null,
        notes: null,
        status: ma.status,
        city: ma.city,
        type: ma.type,
        imageUrl: ma.imageUrl,
        dayIndex: null,
        confirmationCode: null,
        shareToken: ma.shareToken,
        trip: ma.trip,
      },
    };
  } else {
    sanitizedEntity = entity;
  }

  return <ShareItemView token={token} entity={sanitizedEntity} isSignedIn={isSignedIn} />;
}
