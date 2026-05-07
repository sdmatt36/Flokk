import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { CONTINENT_CONFIGS } from "@/lib/continents";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

export function generateStaticParams() {
  return CONTINENT_CONFIGS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const continent = CONTINENT_CONFIGS.find((c) => c.slug === slug);
  if (!continent) return { title: "Not found | Flokk" };
  return {
    title: `${continent.label} | Flokk`,
    description: continent.tagline,
  };
}

export default async function ContinentPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const continent = CONTINENT_CONFIGS.find((c) => c.slug === slug);
  if (!continent) notFound();

  return (
    <main>
      {/* Tagline band */}
      <div
        className="flex flex-col items-center justify-center h-24 md:h-36 gap-2 text-center px-4"
        style={{ backgroundColor: "#1B3A5C" }}
      >
        <p
          className={`${playfair.className} text-3xl md:text-5xl font-normal tracking-tight`}
          style={{ color: "#FAF7F2" }}
        >
          {continent.label}
        </p>
        <p
          className="text-sm md:text-base italic"
          style={{ color: "rgba(250, 247, 242, 0.8)" }}
        >
          {continent.tagline}
        </p>
      </div>

      {/* Placeholder body */}
      <section className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h2
          className={`${playfair.className} text-3xl text-[#1B3A5C]`}
        >
          Coming soon to {continent.label}.
        </h2>
        <p className="text-sm md:text-base italic text-[#1B3A5C]/70 mt-3">
          We&apos;re flokking up something special. Check back soon — or browse{" "}
          <Link href="/trips" className="underline underline-offset-2">
            your trips
          </Link>{" "}
          in the meantime.
        </p>
      </section>
    </main>
  );
}
