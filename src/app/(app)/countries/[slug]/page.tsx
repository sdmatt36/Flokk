import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import { db } from "@/lib/db";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });
const dmsans = DM_Sans({ subsets: ["latin"], display: "swap" });

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
      blurb: true,
      _count: { select: { cities: true } },
      continent: { select: { slug: true, name: true } },
    },
  });
  if (!country) notFound();

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

        {country.blurb ? (
          <p
            className={`${dmsans.className} text-sm md:text-base italic`}
            style={{ color: "rgba(250, 247, 242, 0.8)" }}
          >
            {country.blurb}
          </p>
        ) : country._count.cities > 0 ? (
          <p
            className={`${dmsans.className} text-sm md:text-base`}
            style={{ color: "rgba(250, 247, 242, 0.8)" }}
          >
            {country._count.cities} {country._count.cities === 1 ? "city" : "cities"}
          </p>
        ) : (
          <p
            className={`${dmsans.className} text-sm md:text-base italic`}
            style={{ color: "rgba(250, 247, 242, 0.6)" }}
          >
            Coming soon
          </p>
        )}
      </div>

      {/* Placeholder body */}
      <section className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h2 className={`${playfair.className} text-3xl text-[#1B3A5C]`}>
          Coming soon to {country.name}.
        </h2>
        <Link
          href={`/continents/${country.continent.slug}`}
          className={`${dmsans.className} text-sm md:text-base mt-4 inline-block hover:underline underline-offset-2`}
          style={{ color: "#C4664A" }}
        >
          Browse cities in {country.continent.name} →
        </Link>
      </section>
    </main>
  );
}
