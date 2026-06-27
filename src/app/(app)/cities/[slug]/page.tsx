import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { fetchCityData } from "@/lib/discover-data";
import { CityHero } from "./_components/CityHero";
import { SectionNav } from "./_components/SectionNav";
import { CitySection } from "./_components/CitySection";
import { SpotSection } from "./_components/SpotSection";
import { CommunityTripCard } from "@/components/shared/cards/CommunityTripCard";
import { TourCard } from "@/components/shared/cards/TourCard";
import { ScopedSearchBar } from "@/components/shared/ScopedSearchBar";
import { LateralPeerNav } from "@/components/shared/LateralPeerNav";
import { FlokkersAlsoLove } from "@/components/shared/FlokkersAlsoLove";
import { BackBar } from "@/components/shared/BackBar";

// ── SEO ───────────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchCityData(slug);
  if (!data) return { title: "City not found | Flokk" };

  const { city } = data;
  const countryName = city.country.name;
  const title = `${city.name}, ${countryName} | Itineraries, Tours & Local Picks - Flokk`;
  const description =
    city.blurb ??
    `Explore ${city.name}, ${countryName}: family-curated itineraries, self-guided tours, and local picks from the Flokk community.`;

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
  const data = await fetchCityData(slug);
  if (!data) notFound();

  const {
    city, spotCount, itineraryCount, tourCount, ratingCount,
    siblingCities, itineraries, tours, foodAndDrink, activities, lodging,
  } = data;
  const country = city.country;
  const continent = country.continent;

  const continentSlug = slugifyContinent(continent.name);
  const countrySlug = slugifyCountry(country.name);

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

      <BackBar
        backLabel={`Back to ${country.name}`}
        backHref={`/countries/${countrySlug}`}
        crumbs={[
          { label: "Destinations", href: "/discover" },
          { label: continent.name, href: `/continents/${continentSlug}` },
        ]}
      />

      <CityHero
        cityName={city.name}
        latitude={city.latitude}
        longitude={city.longitude}
        photoUrl={city.photoUrl}
        heroPhotoUrl={city.heroPhotoUrl}
        heroPhotoAttribution={city.heroPhotoAttribution}
        blurb={city.blurb}
        spotCount={spotCount}
        tripCount={itineraryCount}
        tourCount={tourCount}
        ratingCount={ratingCount}
      />

      <SectionNav
        cityName={city.name}
        countryName={country.name}
        countrySlug={countrySlug}
        continentName={continent.name}
        continentSlug={continentSlug}
      />

      {/* Scoped search + sibling city pills */}
      <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "16px 24px 0", display: "flex", flexDirection: "column", gap: "10px" }}>
        <ScopedSearchBar
          scope="city"
          scopeId={city.id}
          scopeName={city.name}
        />
        <LateralPeerNav
          variant="pills"
          peers={siblingCities}
          currentSlug={slug}
          routePrefix="/cities"
          label="Also in this country"
        />
      </div>

      <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "0 24px 80px" }}>
        {/* Itineraries */}
        <CitySection
          id="itineraries"
          title="Itineraries"
          count={itineraries.length}
          emptyText="No itineraries here yet. Plan one and share."
          isEmpty={itineraries.length === 0}
          addHref="/trips/new"
          addLabel="Add →"
          ctaPrefillCity={city.name}
          ctaDefaultTab="itinerary"
        >
          {itineraries.map((trip) => (
            <div key={trip.id}>
              <CommunityTripCard trip={trip} />
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
          ctaPrefillCity={city.name}
          ctaDefaultTab="tour"
        >
          {tours.map((tour) => (
            <div key={tour.id}>
              <TourCard
                tour={{
                  id: tour.id,
                  title: tour.title,
                  destinationCity: tour.destinationCity ?? "",
                  destinationCountry: tour.destinationCountry,
                  shareToken: tour.shareToken,
                  stopCount: tour.stopCount,
                  transport: tour.transport,
                  firstStopImageUrl: tour.firstStopImageUrl,
                }}
              />
            </div>
          ))}
        </CitySection>

        {/* Food */}
        <SpotSection
          id="food"
          title="Food & Drink"
          spots={foodAndDrink.items}
          cityName={city.name}
          emptyText="No food picks yet. Got a favorite? Share it."
          filterField="cuisine"
          addHref={`/saves?city=${encodeURIComponent(city.name)}&category=food_and_drink`}
        />

        {/* Activities */}
        <SpotSection
          id="activities"
          title="Activities"
          spots={activities.items}
          cityName={city.name}
          emptyText={`No activities yet. Help us build ${city.name}.`}
          filterField="category"
          addHref={`/saves?city=${encodeURIComponent(city.name)}&category=experiences`}
        />

        {/* Lodging */}
        <SpotSection
          id="lodging"
          title="Lodging"
          spots={lodging.items}
          cityName={city.name}
          emptyText="No lodging picks yet."
          filterField="lodgingType"
          addHref={`/saves?city=${encodeURIComponent(city.name)}&category=lodging`}
        />

        {/* Flokkers also love */}
        <FlokkersAlsoLove variant="city" entityId={city.id} />

      </div>
    </>
  );
}
