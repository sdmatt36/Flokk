import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import { db } from "@/lib/db";
import { CountrySectionNav } from "./_components/CountrySectionNav";
import { CountryCityGrid } from "./_components/CountryCityGrid";
import { FilteredItinerariesSection } from "@/app/(app)/discover/_components/FilteredItinerariesSection";
import { FilteredToursSection } from "@/app/(app)/discover/_components/FilteredToursSection";
import { FilteredCountrySpotsSection } from "./_components/FilteredCountrySpotsSection";
import { ScopedSearchBar } from "@/components/shared/ScopedSearchBar";
import { LateralPeerNav } from "@/components/shared/LateralPeerNav";
import { FlokkersAlsoLove } from "@/components/shared/FlokkersAlsoLove";

export const dynamic = "force-dynamic";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });
const dmsans = DM_Sans({ subsets: ["latin"], display: "swap" });

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const country = await db.country.findUnique({
    where: { slug },
    select: { name: true, continent: { select: { name: true } } },
  });
  if (!country) return { title: "Not found | Flokk" };
  return {
    title: `${country.name} | Flokk`,
    description: `Explore ${country.name} on Flokk — family travel spots, itineraries, and tours in ${country.continent.name}.`,
  };
}

export default async function CountryPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Step 1: country + cities
  const country = await db.country.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      blurb: true,
      photoUrl: true,
      photoCredit: true,
      continentId: true,
      continent: { select: { name: true, slug: true } },
      cities: {
        where: { featured: true, type: "CITY" },
        select: {
          id: true,
          slug: true,
          name: true,
          photoUrl: true,
          heroPhotoUrl: true,
          _count: { select: { communitySpots: true } },
        },
        orderBy: [{ priorityRank: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!country) notFound();

  const allCities = country.cities.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    photoUrl: c.photoUrl,
    heroPhotoUrl: c.heroPhotoUrl,
    spotCount: c._count.communitySpots,
  }));

  // Step 2: content sections + sibling countries in parallel
  const [trips, spots, tours, siblingCountries] = await Promise.all([
    db.trip.findMany({
      where: {
        destinationCountry: country.name,
        isPublic: true,
        isAnonymous: true,
      },
      select: {
        id: true,
        title: true,
        destinationCity: true,
        destinationCountry: true,
        shareToken: true,
        heroImageUrl: true,
        isAnonymous: true,
        startDate: true,
        endDate: true,
        familyProfile: { select: { familyName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.communitySpot.findMany({
      where: {
        isPublic: true,
        OR: [
          { country: country.name },
          { geoCity: { countryId: country.id } },
        ],
      },
      select: {
        id: true,
        name: true,
        city: true,
        category: true,
        photoUrl: true,
        shareToken: true,
        averageRating: true,
        ratingCount: true,
        description: true,
      },
      orderBy: [{ averageRating: "desc" }, { ratingCount: "desc" }],
      take: 200,
    }),
    db.generatedTour.findMany({
      where: {
        destinationCountry: country.name,
        isPublic: true,
      },
      select: {
        id: true,
        title: true,
        destinationCity: true,
        destinationCountry: true,
        shareToken: true,
        transport: true,
        _count: { select: { stops: true } },
        stops: {
          select: { imageUrl: true },
          orderBy: { orderIndex: "asc" },
          take: 1,
        },
      },
      take: 50,
    }),
    db.country.findMany({
      where: { continentId: country.continentId, id: { not: country.id } },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
  ]);

  console.log(`[CountryPage] slug=${slug} itineraries=${trips.length} spots=${spots.length} tours=${tours.length}`);

  const totalSpots = country.cities.reduce((sum, c) => sum + c._count.communitySpots, 0);

  const FOOD_CATS = new Set(["food_and_drink"]);
  const LODGING_CATS = new Set(["lodging"]);
  const foodSpots = spots.filter((s) => FOOD_CATS.has(s.category ?? ""));
  const lodgingSpots = spots.filter((s) => LODGING_CATS.has(s.category ?? ""));
  const activitySpots = spots.filter(
    (s) => !FOOD_CATS.has(s.category ?? "") && !LODGING_CATS.has(s.category ?? "")
  );

  // Shape tours into TourCardItem
  const tourItems = tours.map((t) => ({
    id: t.id,
    title: t.title,
    destinationCity: t.destinationCity,
    destinationCountry: t.destinationCountry,
    shareToken: t.shareToken,
    transport: t.transport,
    stopCount: t._count.stops,
    firstStopImageUrl: t.stops[0]?.imageUrl ?? null,
  }));

  return (
    <main className={dmsans.className} style={{ minHeight: "100vh", backgroundColor: "#FAF7F2" }}>

      {/* Hero */}
      <div
        style={{
          height: "320px",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#1B3A5C",
          backgroundImage: country.photoUrl ? `url('${country.photoUrl}')` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Top scrim — breadcrumb legibility */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "40%",
            zIndex: 1,
            background: country.photoUrl
              ? "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 30%, transparent 60%)"
              : "none",
          }}
        />
        {/* Bottom scrim */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "70%",
            zIndex: 1,
            background: country.photoUrl
              ? "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.45) 25%, rgba(0,0,0,0.15) 50%, transparent 70%)"
              : "linear-gradient(135deg, #1B3A5C 0%, #1B3A5C 50%, #0d2438 100%)",
          }}
        />
        {/* Localized text backdrop */}
        {country.photoUrl && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "min(720px, 100%)",
              height: "60%",
              zIndex: 1,
              pointerEvents: "none",
              background: "radial-gradient(ellipse 70% 55% at 22% 75%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0.1) 70%, transparent 85%)",
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            bottom: "28px",
            left: "28px",
            right: "28px",
            zIndex: 2,
          }}
        >
          {/* Breadcrumb */}
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.95)", marginBottom: "8px", textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
            <Link
              href="/discover"
              style={{ color: "rgba(255,255,255,0.95)", textDecoration: "none" }}
            >
              Destinations
            </Link>
            {" › "}
            <Link
              href={`/continents/${country.continent.slug}`}
              style={{ color: "rgba(255,255,255,0.95)", textDecoration: "none" }}
            >
              {country.continent.name}
            </Link>
          </p>

          <h1
            className={playfair.className}
            style={{
              fontSize: "36px",
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.15,
              marginBottom: "8px",
              textShadow: country.photoUrl ? "0 2px 16px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.6)" : "none",
            }}
          >
            {country.name}
          </h1>

          {country.blurb && (
            <p
              style={{
                fontSize: "14px",
                color: "rgba(255,255,255,0.92)",
                lineHeight: 1.5,
                maxWidth: "560px",
                marginBottom: "12px",
                textShadow: "0 1px 6px rgba(0,0,0,0.75)",
              }}
            >
              {country.blurb}
            </p>
          )}

          {/* Stat chips */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {allCities.length > 0 && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  backgroundColor: "rgba(255,255,255,0.18)",
                  color: "#fff",
                  borderRadius: "999px",
                  padding: "4px 12px",
                  backdropFilter: "blur(4px)",
                }}
              >
                {allCities.length} {allCities.length === 1 ? "city" : "cities"}
              </span>
            )}
            {totalSpots > 0 && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  backgroundColor: "rgba(255,255,255,0.18)",
                  color: "#fff",
                  borderRadius: "999px",
                  padding: "4px 12px",
                  backdropFilter: "blur(4px)",
                }}
              >
                {totalSpots} {totalSpots === 1 ? "spot" : "spots"}
              </span>
            )}
          </div>
        </div>

        {country.photoCredit && (
          <p
            style={{
              position: "absolute",
              bottom: "6px",
              right: "12px",
              fontSize: "10px",
              color: "rgba(255,255,255,0.45)",
              zIndex: 2,
            }}
          >
            {country.photoCredit}
          </p>
        )}
      </div>

      {/* Sticky section nav */}
      <CountrySectionNav
        continentName={country.continent.name}
        continentSlug={country.continent.slug}
        countryName={country.name}
      />

      {/* Search + peer nav bar */}
      <div
        style={{
          maxWidth: "1080px",
          margin: "0 auto",
          padding: "16px 24px 0",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <ScopedSearchBar
          scope="country"
          scopeId={country.id}
          scopeName={country.name}
        />
        <LateralPeerNav
          variant="dropdown"
          peers={siblingCountries}
          currentSlug={slug}
          routePrefix="/countries"
          label="Switch country"
        />
      </div>

      {/* Content */}
      <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "0 24px 64px" }}>

        {/* Cities */}
        <section id="cities" style={{ paddingTop: "48px", paddingBottom: "8px", scrollMarginTop: "108px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
            <h2
              className={playfair.className}
              style={{ fontSize: "22px", fontWeight: 700, color: "#1B3A5C", margin: 0 }}
            >
              Cities
            </h2>
            {allCities.length > 0 && (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#C4664A",
                  backgroundColor: "#FFF3EE",
                  borderRadius: "20px",
                  padding: "2px 10px",
                }}
              >
                {allCities.length}
              </span>
            )}
          </div>
          {allCities.length === 0 ? (
            <div className="mt-12 mx-auto max-w-xl text-center px-6">
              <p className="text-lg italic text-[#1B3A5C]">
                &ldquo;We&rsquo;re still curating featured destinations for {country.name}. Have a recommendation?&rdquo;
              </p>
              <a
                href={`mailto:hello@flokktravel.com?subject=${encodeURIComponent(`Featured destination request: ${country.name}`)}`}
                className="mt-4 inline-block font-medium text-[#C4664A] hover:underline"
              >
                Tell us
              </a>
            </div>
          ) : (
            <CountryCityGrid cities={allCities} countryName={country.name} />
          )}
        </section>

        {/* Itineraries */}
        <FilteredItinerariesSection
          id="itineraries"
          trips={trips}
          emptyText={`No public itineraries yet for ${country.name}. Be the first to share one.`}
        />

        {/* Food & Drink */}
        <FilteredCountrySpotsSection
          id="food"
          title="Food & Drink"
          spots={foodSpots}
          emptyText={`No food & drink picks for ${country.name} yet.`}
        />

        {/* Activities */}
        <FilteredCountrySpotsSection
          id="activities"
          title="Activities"
          spots={activitySpots}
          emptyText={`No activity picks for ${country.name} yet.`}
        />

        {/* Lodging */}
        <FilteredCountrySpotsSection
          id="lodging"
          title="Lodging"
          spots={lodgingSpots}
          emptyText={`No lodging picks for ${country.name} yet.`}
        />

        {/* Tours */}
        <FilteredToursSection
          id="tours"
          tours={tourItems}
          emptyText={`No public tours yet for ${country.name}.`}
        />

        {/* Flokkers also love */}
        <FlokkersAlsoLove variant="country" entityId={country.id} />

      </div>
    </main>
  );
}
