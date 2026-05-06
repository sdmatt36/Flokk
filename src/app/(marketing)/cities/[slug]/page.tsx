import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { CityHero } from "./_components/CityHero";
import { SectionNav } from "./_components/SectionNav";
import { CitySection } from "./_components/CitySection";
import { ActivitiesSection } from "./_components/ActivitiesSection";
import { SubmitContentCTA } from "./_components/SubmitContentCTA";
import { TripCard, TourCard, SpotCard } from "./_components/cards";

// ── DB ────────────────────────────────────────────────────────────────────────

function getDb() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

// ── Category buckets ─────────────────────────────────────────────────────────

const FOOD_CATEGORIES = new Set(["food_and_drink", "Food", "food"]);
const LODGING_CATEGORIES = new Set(["lodging", "Lodging"]);

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadCity(slug: string) {
  const db = getDb();
  try {
    const city = await db.city.findUnique({
      where: { slug },
      include: { country: { include: { continent: true } } },
    });
    if (!city) return null;

    const [spots, trips, tours] = await Promise.all([
      db.communitySpot.findMany({
        where: { cityId: city.id },
        select: {
          id: true, name: true, category: true,
          photoUrl: true, averageRating: true, ratingCount: true, description: true,
        },
        orderBy: [{ ratingCount: "desc" }, { averageRating: "desc" }],
        take: 50,
      }),
      db.trip.findMany({
        where: {
          isPublic: true,
          destinationCity: { contains: city.name, mode: "insensitive" },
        },
        select: {
          id: true, title: true, destinationCity: true, destinationCountry: true,
          heroImageUrl: true, shareToken: true, startDate: true, endDate: true, isAnonymous: true,
        },
        orderBy: { viewCount: "desc" },
        take: 12,
      }),
      db.generatedTour.findMany({
        where: {
          isPublic: true,
          deletedAt: null,
          destinationCity: { contains: city.name, mode: "insensitive" },
        },
        select: {
          id: true, title: true, destinationCity: true, destinationCountry: true,
          shareToken: true, transport: true,
          stops: { select: { id: true }, where: { deletedAt: null } },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
    ]);

    return { city, spots, trips, tours };
  } finally {
    await db.$disconnect();
  }
}

// ── SEO ───────────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadCity(slug);
  if (!data) return { title: "City not found | Flokk" };

  const { city } = data;
  const countryName = city.country.name;
  const title = `${city.name}, ${countryName} | Itineraries, Tours & Local Picks - Flokk`;
  const description =
    city.blurb ??
    `Explore ${city.name}, ${countryName} — family-curated itineraries, self-guided tours, and local picks from the Flokk community.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

function slugifyContinent(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function slugifyCountry(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadCity(slug);
  if (!data) notFound();

  const { city, spots, trips, tours } = data;
  const country = city.country;
  const continent = country.continent;

  const continentSlug = slugifyContinent(continent.name);
  const countrySlug = slugifyCountry(country.name);

  // Bucket spots by category
  const foodSpots = spots.filter((s) => FOOD_CATEGORIES.has(s.category ?? ""));
  const lodgingSpots = spots.filter((s) => LODGING_CATEGORIES.has(s.category ?? ""));
  const activitySpots = spots.filter(
    (s) => !FOOD_CATEGORIES.has(s.category ?? "") && !LODGING_CATEGORIES.has(s.category ?? "")
  );

  // JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelDestination",
    name: city.name,
    addressCountry: country.name,
    ...(city.latitude !== null && city.longitude !== null
      ? { geo: { "@type": "GeoCoordinates", latitude: city.latitude, longitude: city.longitude } }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <CityHero
        cityName={city.name}
        countryName={country.name}
        countrySlug={countrySlug}
        continentName={continent.name}
        continentSlug={continentSlug}
        latitude={city.latitude}
        longitude={city.longitude}
        tags={city.tags}
      />

      <SectionNav />

      <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "0 24px 80px" }}>
        {/* Itineraries */}
        <CitySection
          id="itineraries"
          title="Itineraries"
          count={trips.length}
          emptyText="No itineraries here yet. Plan one and share."
          isEmpty={trips.length === 0}
          addHref="/trips/new"
          addLabel="Add →"
        >
          {trips.map((trip) => (
            <div key={trip.id} style={{ scrollSnapAlign: "start" }}>
              <TripCard trip={trip} />
            </div>
          ))}
        </CitySection>

        {/* Tours */}
        <CitySection
          id="tours"
          title="Tours"
          count={tours.length}
          emptyText={`No tours yet. Build one for ${city.name}.`}
          isEmpty={tours.length === 0}
          addHref="/tour"
          addLabel="Build one →"
        >
          {tours.map((tour) => (
            <div key={tour.id} style={{ scrollSnapAlign: "start" }}>
              <TourCard
                tour={{
                  id: tour.id,
                  title: tour.title,
                  destinationCity: tour.destinationCity,
                  destinationCountry: tour.destinationCountry,
                  shareToken: tour.shareToken,
                  stopCount: tour.stops.length,
                  transport: tour.transport,
                }}
              />
            </div>
          ))}
        </CitySection>

        {/* Food */}
        <CitySection
          id="food"
          title="Food & Drink"
          count={foodSpots.length}
          emptyText="No food picks yet. Got a favorite? Share it."
          isEmpty={foodSpots.length === 0}
        >
          {foodSpots.map((spot) => (
            <div key={spot.id} style={{ scrollSnapAlign: "start" }}>
              <SpotCard spot={spot} />
            </div>
          ))}
        </CitySection>

        {/* Activities (client — has filter pills) */}
        <ActivitiesSection spots={activitySpots} cityName={city.name} />

        {/* Lodging */}
        <CitySection
          id="lodging"
          title="Lodging"
          count={lodgingSpots.length}
          emptyText="No lodging picks yet."
          isEmpty={lodgingSpots.length === 0}
        >
          {lodgingSpots.map((spot) => (
            <div key={spot.id} style={{ scrollSnapAlign: "start" }}>
              <SpotCard spot={spot} />
            </div>
          ))}
        </CitySection>

        <SubmitContentCTA cityName={city.name} />
      </div>
    </>
  );
}
