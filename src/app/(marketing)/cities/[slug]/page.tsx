import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { normalizeCategorySlug } from "@/lib/categories";
import { CityHero } from "./_components/CityHero";
import { SectionNav } from "./_components/SectionNav";
import { CitySection } from "./_components/CitySection";
import { SpotSection } from "./_components/SpotSection";
import { SubmitContentCTA } from "./_components/SubmitContentCTA";
import { TripCard, TourCard } from "./_components/cards";

// ── DB ────────────────────────────────────────────────────────────────────────

function getDb() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

// ── Category buckets ─────────────────────────────────────────────────────────

const FOOD_CATEGORIES = new Set(["food_and_drink", "Food", "food"]);
const LODGING_CATEGORIES = new Set(["lodging", "Lodging"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugForDedup(s: string): string {
  return s.toLowerCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchCityPhoto(cityName: string, countryName: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  try {
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${cityName}, ${countryName}`)}&type=locality&key=${apiKey}`,
      { cache: "no-store" }
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json() as { results?: Array<{ photos?: Array<{ photo_reference: string }> }> };
    const photoRef = searchData.results?.[0]?.photos?.[0]?.photo_reference;
    if (!photoRef) return null;
    const photoRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photoRef}&key=${apiKey}`,
      { redirect: "follow", cache: "no-store" }
    );
    const finalUrl = photoRes.url;
    return finalUrl.startsWith("https://lh3.googleusercontent.com") ? finalUrl : null;
  } catch {
    return null;
  }
}

// ── Data loading ──────────────────────────────────────────────────────────────

type SpotItem = {
  id: string;
  name: string;
  category: string | null;
  photoUrl: string | null;
  averageRating: number | null;
  ratingCount: number;
  description: string | null;
};

async function loadCity(slug: string) {
  const db = getDb();
  try {
    const city = await db.city.findUnique({
      where: { slug },
      include: { country: { include: { continent: true } } },
    });
    if (!city) return null;

    interface RatingRow {
      name: string;
      category: string;
      averageRating: number;
      ratingCount: bigint | number;
    }

    const [spots, trips, tours, ratingRows] = await Promise.all([
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
      db.$queryRaw<RatingRow[]>`
        SELECT
          "placeName" AS name,
          "placeType" AS category,
          AVG("rating")::float AS "averageRating",
          COUNT(DISTINCT "familyProfileId")::int AS "ratingCount"
        FROM "PlaceRating"
        WHERE LOWER("destinationCity") = LOWER(${city.name})
        GROUP BY "placeName", "placeType"
      `,
    ]);

    // Build dedup map from CommunitySpot — key by slug(name) only.
    // Sort order ensures highest-rated CS wins on name collision.
    const spotMap = new Map<string, SpotItem>();
    for (const s of spots) {
      const nameKey = slugForDedup(s.name);
      if (!spotMap.has(nameKey)) {
        const normCat = normalizeCategorySlug(s.category) ?? s.category;
        spotMap.set(nameKey, { ...s, category: normCat });
      }
    }

    // Merge PlaceRating aggregates — key by slug(name) only.
    // CS row wins for visual data (photo, category, description).
    // Ratings aggregate: weighted average + summed count.
    const prOnlyMap = new Map<string, SpotItem>();
    for (const row of ratingRows) {
      const nameKey = slugForDedup(row.name);
      const count = Number(row.ratingCount);
      const normCat = normalizeCategorySlug(row.category) ?? "other";
      const csEntry = spotMap.get(nameKey);

      if (csEntry) {
        // Augment CommunitySpot with aggregated PlaceRating data
        const newCount = csEntry.ratingCount + count;
        const newAvg = ((csEntry.averageRating ?? 0) * csEntry.ratingCount + row.averageRating * count) / newCount;
        // Promote PR's specific category when CS has the low-info 'other' fallback.
        const promotedCategory =
          csEntry.category === "other" && normCat && normCat !== "other"
            ? normCat
            : csEntry.category;
        spotMap.set(nameKey, { ...csEntry, category: promotedCategory, averageRating: newAvg, ratingCount: newCount });
      } else {
        // PR-only: aggregate multiple placeType rows for same place name
        const prEntry = prOnlyMap.get(nameKey);
        if (prEntry) {
          const newCount = prEntry.ratingCount + count;
          const newAvg = ((prEntry.averageRating ?? 0) * prEntry.ratingCount + row.averageRating * count) / newCount;
          prOnlyMap.set(nameKey, { ...prEntry, averageRating: newAvg, ratingCount: newCount });
        } else {
          prOnlyMap.set(nameKey, {
            id: `pr_${nameKey}`,
            name: row.name,
            category: normCat,
            photoUrl: null,
            averageRating: row.averageRating,
            ratingCount: count,
            description: null,
          });
        }
      }
    }

    const allSpots: SpotItem[] = [...spotMap.values(), ...prOnlyMap.values()];

    // Fetch and cache city photo on first visit
    let photoUrl = city.photoUrl;
    if (!photoUrl) {
      photoUrl = await fetchCityPhoto(city.name, city.country.name);
      if (photoUrl) {
        await db.city.update({ where: { id: city.id }, data: { photoUrl } });
      }
    }

    return { city: { ...city, photoUrl }, spots: allSpots, trips, tours };
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
        photoUrl={city.photoUrl}
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
            <div key={trip.id}>
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
            <div key={tour.id}>
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
        <SpotSection
          id="food"
          title="Food & Drink"
          spots={foodSpots}
          cityName={city.name}
          emptyText="No food picks yet. Got a favorite? Share it."
        />

        {/* Activities */}
        <SpotSection
          id="activities"
          title="Activities"
          spots={activitySpots}
          cityName={city.name}
          emptyText={`No activities yet. Help us build ${city.name}.`}
          showCategoryFilter
        />

        {/* Lodging */}
        <SpotSection
          id="lodging"
          title="Lodging"
          spots={lodgingSpots}
          cityName={city.name}
          emptyText="No lodging picks yet."
        />

        <SubmitContentCTA cityName={city.name} />
      </div>
    </>
  );
}
