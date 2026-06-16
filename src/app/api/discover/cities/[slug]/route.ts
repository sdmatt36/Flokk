import { NextRequest, NextResponse } from "next/server";
import { fetchCityData } from "@/lib/discover-data";
import { getCityImageUrl } from "@/lib/city-image";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const data = await fetchCityData(slug);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const {
    city, spotCount, itineraryCount, tourCount,
    siblingCities, itineraries, tours,
    foodAndDrink, activities, lodging, relatedCities,
  } = data;

  return NextResponse.json({
    city: {
      slug: city.slug,
      name: city.name,
      heroImageUrl: getCityImageUrl(city.heroPhotoUrl, city.photoUrl),
      description: city.blurb,
      spotCount,
      itineraryCount,
      tourCount,
      country: { slug: city.country.slug, name: city.country.name },
      continent: { slug: city.country.continent.slug, name: city.country.continent.name },
    },
    siblingCities,
    itineraries,
    tours,
    foodAndDrink,
    activities,
    lodging,
    relatedCities,
  });
}
