import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { db } from "@/lib/db";
import { CONTINENT_CONFIGS } from "@/lib/continents";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

export async function generateStaticParams() {
  const countries = await db.country.findMany({ select: { slug: true } });
  return countries.map((c) => ({ slug: c.slug }));
}

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
    description: `Explore ${country.name} on Flokk — family travel in ${country.continent.name}.`,
  };
}

export default async function CountryPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const country = await db.country.findUnique({
    where: { slug },
    select: {
      name: true,
      continent: { select: { slug: true, name: true } },
    },
  });
  if (!country) notFound();

  const continentConfig = CONTINENT_CONFIGS.find((c) => c.slug === country.continent.slug);

  return (
    <main>
      {/* Hero band */}
      <div
        className="flex flex-col items-center justify-center py-16 md:py-20 gap-2 text-center px-4"
        style={{ backgroundColor: "#1B3A5C" }}
      >
        <p
          className={`${playfair.className} text-4xl md:text-5xl font-normal tracking-tight`}
          style={{ color: "#FAF7F2" }}
        >
          {country.name}
        </p>
        {continentConfig && (
          <p
            className="text-sm md:text-base italic"
            style={{ color: "rgba(250, 247, 242, 0.8)" }}
          >
            {continentConfig.tagline}
          </p>
        )}
      </div>

      {/* Placeholder body */}
      <section className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h2 className={`${playfair.className} text-3xl text-[#1B3A5C]`}>
          Coming soon to {country.name}.
        </h2>
        <p className="text-sm md:text-base italic text-[#1B3A5C]/70 mt-3">
          We&apos;re flokking up something special. Browse{" "}
          <Link
            href={`/continents/${country.continent.slug}`}
            className="underline underline-offset-2"
          >
            {country.continent.name}
          </Link>{" "}
          in the meantime.
        </p>
      </section>
    </main>
  );
}
