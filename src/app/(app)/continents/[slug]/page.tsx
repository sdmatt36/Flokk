import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import { db } from "@/lib/db";
import { CONTINENT_CONFIGS } from "@/lib/continents";
import { CountryGrid } from "./_components/CountryGrid";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });
const dmsans = DM_Sans({ subsets: ["latin"], display: "swap" });

export function generateStaticParams() {
  return CONTINENT_CONFIGS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const config = CONTINENT_CONFIGS.find((c) => c.slug === slug);
  if (!config) return { title: "Not found | Flokk" };
  return {
    title: `${config.label} | Flokk`,
    description: config.tagline,
  };
}

export default async function ContinentPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const config = CONTINENT_CONFIGS.find((c) => c.slug === slug);
  if (!config) notFound();

  const continent = await db.continent.findUnique({
    where: { slug },
    select: {
      blurb: true,
      countries: {
        orderBy: { name: "asc" },
        select: {
          slug: true,
          name: true,
          _count: { select: { cities: true } },
          cities: {
            select: {
              name: true,
              _count: { select: { communitySpots: true } },
            },
          },
        },
      },
    },
  });

  if (!continent) notFound();

  // Server-side: compute spot totals and top-3 cities per country
  const countries = continent.countries.map((c) => ({
    slug: c.slug,
    name: c.name,
    _count: c._count,
    spotCount: c.cities.reduce((sum, city) => sum + city._count.communitySpots, 0),
    topCities: [...c.cities]
      .sort((a, b) => b._count.communitySpots - a._count.communitySpots)
      .filter((city) => city._count.communitySpots > 0)
      .slice(0, 3)
      .map((city) => ({ name: city.name })),
  }));

  return (
    <main>
      {/* Hero band */}
      <div
        className="relative flex flex-col items-center justify-center py-16 md:py-20 text-center px-4 overflow-hidden"
        style={{ backgroundColor: "#1B3A5C" }}
      >
        {/* Silhouette watermark */}
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: config.color,
            opacity: 0.12,
            WebkitMaskImage: `url(/svg/continents/${slug}.svg)`,
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            WebkitMaskSize: "contain",
            maskImage: `url(/svg/continents/${slug}.svg)`,
            maskRepeat: "no-repeat",
            maskPosition: "center",
            maskSize: "contain",
          }}
        />

        {/* Text — above watermark */}
        <div className="relative z-10">
          <h1
            className={`${playfair.className} text-5xl md:text-6xl font-normal tracking-tight`}
            style={{ color: "#FAF7F2" }}
          >
            {config.label}
          </h1>
          <p
            className={`${dmsans.className} text-base md:text-lg italic mt-2`}
            style={{ color: "rgba(250, 247, 242, 0.8)" }}
          >
            {config.tagline}
          </p>
          <p
            className={`${dmsans.className} text-sm mt-4`}
            style={{ color: "rgba(250, 247, 242, 0.6)" }}
          >
            {continent.countries.length} countries
          </p>
        </div>
      </div>

      {/* Blurb */}
      {continent.blurb && (
        <section className="max-w-prose mx-auto px-6 py-12 md:py-16 text-center">
          <p className={`${playfair.className} text-lg md:text-xl text-[#1B3A5C] leading-relaxed`}>
            {continent.blurb}
          </p>
        </section>
      )}

      {/* Countries grid */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <CountryGrid
          countries={countries}
          continentColor={config.color}
          playfairClassName={playfair.className}
        />
      </section>
    </main>
  );
}
