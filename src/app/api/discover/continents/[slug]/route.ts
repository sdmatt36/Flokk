import { NextRequest, NextResponse } from "next/server";
import { CONTINENT_CONFIGS } from "@/lib/continents";
import { fetchContinentData } from "@/lib/discover-data";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const config = CONTINENT_CONFIGS.find((c) => c.slug === slug);
  if (!config) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = await fetchContinentData(slug);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { continent, countries } = data;

  return NextResponse.json({
    continent: {
      slug,
      name: continent.name,
      tagline: config.tagline,
      description: continent.blurb,
      heroImageUrl: continent.photoUrl,
      countryCount: countries.length,
    },
    countries: countries.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      coverImageUrl: c.coverImageUrl,
      cityCount: c._count.cities,
      sampleCities: c.topCities.map((t) => t.name),
    })),
  });
}
