import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import { db } from "@/lib/db";
import { CountrySectionNav } from "./_components/CountrySectionNav";
import { CountrySection } from "./_components/CountrySection";
import { CountryCityCard } from "./_components/CountryCityCard";
import { CommunitySpotCard } from "@/components/shared/cards/CommunitySpotCard";
import { CommunityTripCard } from "@/components/shared/cards/CommunityTripCard";
import { TourCard } from "@/components/shared/cards/TourCard";

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

  // Step 1: country + cities (cities needed for spotCount sort and city section)
  const country = await db.country.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      blurb: true,
      photoUrl: true,
      photoCredit: true,
      continent: { select: { name: true, slug: true } },
      _count: { select: { cities: true } },
      cities: {
        select: {
          id: true,
          slug: true,
          name: true,
          photoUrl: true,
          _count: { select: { communitySpots: true } },
        },
      },
    },
  });

  if (!country) notFound();

  // Sort cities by spotCount descending, take top 6
  const topCities = [...country.cities]
    .sort((a, b) => b._count.communitySpots - a._count.communitySpots)
    .slice(0, 6);

  // Step 2: content sections in parallel
  const [trips, spots, tours] = await Promise.all([
    db.trip.findMany({
      where: {
        isPublic: true,
        shareToken: { not: null },
        destinationCountry: { contains: country.name, mode: "insensitive" },
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
      orderBy: { viewCount: "desc" },
      take: 8,
    }),
    db.communitySpot.findMany({
      where: {
        geoCity: { countryId: country.id },
        isPublic: true,
        shareToken: { not: null },
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
      take: 12,
    }),
    db.generatedTour.findMany({
      where: {
        isPublic: true,
        deletedAt: null,
        shareToken: { not: null },
        destinationCountry: { contains: country.name, mode: "insensitive" },
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
      take: 8,
    }),
  ]);

  const totalSpots = country.cities.reduce((sum, c) => sum + c._count.communitySpots, 0);

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
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: country.photoUrl
              ? "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.72) 100%)"
              : "linear-gradient(135deg, #1B3A5C 0%, #1B3A5C 50%, #0d2438 100%)",
          }}
        />

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
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", marginBottom: "8px" }}>
            <Link
              href="/continents"
              style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none" }}
            >
              Destinations
            </Link>
            {" › "}
            <Link
              href={`/continents/${country.continent.slug}`}
              style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none" }}
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
              textShadow: country.photoUrl ? "0 2px 16px rgba(0,0,0,0.5)" : "none",
            }}
          >
            {country.name}
          </h1>

          {country.blurb && (
            <p
              style={{
                fontSize: "14px",
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1.5,
                maxWidth: "560px",
                marginBottom: "12px",
              }}
            >
              {country.blurb}
            </p>
          )}

          {/* Stat chips */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {country._count.cities > 0 && (
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
                {country._count.cities} {country._count.cities === 1 ? "city" : "cities"}
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
      <CountrySectionNav />

      {/* Content */}
      <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "0 24px 64px" }}>

        {/* Cities */}
        <CountrySection
          id="cities"
          title="Cities"
          count={topCities.length}
          emptyText={`No cities listed yet for ${country.name}.`}
          isEmpty={topCities.length === 0}
        >
          {topCities.map((city) => (
            <CountryCityCard
              key={city.id}
              slug={city.slug}
              name={city.name}
              photoUrl={city.photoUrl}
              spotCount={city._count.communitySpots}
            />
          ))}
        </CountrySection>

        {/* Itineraries */}
        <CountrySection
          id="itineraries"
          title="Family Itineraries"
          count={trips.length}
          emptyText={`No public itineraries yet for ${country.name}. Be the first to share one.`}
          isEmpty={trips.length === 0}
        >
          {trips.map((trip) => (
            <CommunityTripCard key={trip.id} trip={trip} />
          ))}
        </CountrySection>

        {/* Picks */}
        <CountrySection
          id="picks"
          title="Family Picks"
          count={spots.length}
          emptyText={`No community spots linked to cities in ${country.name} yet.`}
          isEmpty={spots.length === 0}
        >
          {spots.map((spot) => (
            <CommunitySpotCard
              key={spot.id}
              spot={{
                id: spot.id,
                title: spot.name,
                city: spot.city,
                photoUrl: spot.photoUrl,
                category: spot.category,
                rating: spot.averageRating ? Math.round(spot.averageRating) : null,
                ratingCount: spot.ratingCount,
                description: spot.description,
              }}
              href={`/spots/${spot.shareToken!}`}
            />
          ))}
        </CountrySection>

        {/* Tours */}
        <CountrySection
          id="tours"
          title="AI Tours"
          count={tours.length}
          emptyText={`No public tours yet for ${country.name}.`}
          isEmpty={tours.length === 0}
        >
          {tours.map((tour) => (
            <TourCard
              key={tour.id}
              tour={{
                id: tour.id,
                title: tour.title,
                destinationCity: tour.destinationCity,
                destinationCountry: tour.destinationCountry,
                shareToken: tour.shareToken,
                stopCount: tour._count.stops,
                transport: tour.transport,
                firstStopImageUrl: tour.stops[0]?.imageUrl ?? null,
              }}
            />
          ))}
        </CountrySection>

      </div>
    </main>
  );
}
