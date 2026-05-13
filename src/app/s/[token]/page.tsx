import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { resolveShareToken } from "@/lib/share-token";
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

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const entity = await resolveShareToken(token);
  if (!entity) return { title: "Place — Flokk" };

  let title = "Place — Flokk";
  if (entity.entityType === "saved_item" && entity.savedItem) {
    const city = entity.savedItem.destinationCity;
    title = city
      ? `${entity.savedItem.rawTitle ?? "Place"} in ${city} — Flokk`
      : `${entity.savedItem.rawTitle ?? "Place"} — Flokk`;
  } else if (entity.entityType === "itinerary_item" && entity.itineraryItem) {
    title = `${entity.itineraryItem.title} — Flokk`;
  } else if (entity.entityType === "manual_activity" && entity.manualActivity) {
    title = `${entity.manualActivity.title} — Flokk`;
  } else if (entity.entityType === "generated_tour" && entity.generatedTour) {
    const loc = formatTourLocation(
      entity.generatedTour.destinationCity,
      entity.generatedTour.destinationCountry
    );
    title = `${entity.generatedTour.title} · ${loc} — Flokk`;
  }

  return { title };
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
              {tour.title}
            </h1>
            {tour.subtitle && (
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", margin: "0 0 4px" }}>
                {tour.subtitle}
              </p>
            )}
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", margin: 0 }}>
              {locationDisplay} · {tour.durationLabel} · {tour.transport}
            </p>
          </div>
        </div>

        {/* Map + stops + CTA */}
        <TourShareView stops={tour.stops} transport={tour.transport} />

        <div className="hidden md:block">
          <SiteFooter />
        </div>
        <BottomNav />
      </div>
    );
  }

  return <ShareItemView token={token} entity={entity} isSignedIn={isSignedIn} />;
}
