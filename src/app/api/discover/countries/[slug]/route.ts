import { NextRequest, NextResponse } from "next/server";
import { fetchCountryData } from "@/lib/discover-data";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const data = await fetchCountryData(slug);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { country, cities } = data;

  return NextResponse.json({
    country: {
      slug,
      name: country.name,
      heroImageUrl: country.photoUrl,
      description: country.blurb,
      continent: { slug: country.continent.slug, name: country.continent.name },
      cityCount: cities.length,
    },
    cities: cities.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      coverImageUrl: c.coverImageUrl,
      spotCount: c.spotCount,
    })),
  });
}
