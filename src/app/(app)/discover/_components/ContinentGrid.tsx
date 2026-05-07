"use client";

/*
 * Continent cover images — drop into public/images/continents/{slug}.jpg
 *
 * Suggested Unsplash search queries:
 *   asia          → "fushimi inari path"
 *   europe        → "cinque terre vernazza"
 *   africa        → "elephants kilimanjaro"
 *   north-america → "moraine lake banff sunrise"
 *   south-america → "torres del paine sunrise"
 *   oceania       → "milford sound new zealand"
 *   antarctica    → "antarctica expedition ship iceberg"
 */

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

type Continent = {
  slug: string;
  label: string;
  tagline: string;
  color: string;
};

const CONTINENTS: Continent[] = [
  { slug: "asia",          label: "Asia",          tagline: "Temples at dawn, noodles at midnight.",          color: "#B14A3A" },
  { slug: "europe",        label: "Europe",        tagline: "Every train ride leads to a story.",             color: "#C49454" },
  { slug: "africa",        label: "Africa",        tagline: "Where the kids stop talking and just look.",     color: "#C77F2A" },
  { slug: "north-america", label: "North America", tagline: "Pack the car, find the road.",                   color: "#3C6A78" },
  { slug: "south-america", label: "South America", tagline: "High peaks, low jungles, long lunches.",         color: "#5C7E94" },
  { slug: "oceania",       label: "Oceania",       tagline: "Where the road ends, the water starts.",         color: "#2E6B6F" },
  { slug: "antarctica",    label: "Antarctica",    tagline: "Start in Ushuaia. Tell your flokk how it ended.", color: "#7A8B9C" },
];

function ContinentTile({
  continent,
  playfairClassName,
  className = "",
}: {
  continent: Continent;
  playfairClassName: string;
  className?: string;
}) {
  const router = useRouter();
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <button
      onClick={() => router.push(`/continents/${continent.slug}`)}
      className={`group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer text-left transition-transform duration-300 hover:scale-[1.02] w-full ${className}`}
      style={{ backgroundColor: continent.color }}
    >
      {!imageFailed && (
        <Image
          src={`/images/continents/${continent.slug}.jpg`}
          alt={continent.label}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 280px"
          className="object-cover"
          onError={() => setImageFailed(true)}
        />
      )}

      {/* Gradient — always present so text reads against colour fallback too */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {/* Hover arrow */}
      <ArrowRight
        size={20}
        className="absolute top-3 right-3 text-[#FAF7F2] opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      />

      {/* Text block */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
        <span className={`${playfairClassName} text-2xl md:text-3xl text-[#FAF7F2] block`}>
          {continent.label}
        </span>
        <span className="text-sm md:text-base italic text-[#FAF7F2]/85 mt-1 block">
          {continent.tagline}
        </span>
      </div>
    </button>
  );
}

export function ContinentGrid({ playfairClassName }: { playfairClassName: string }) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
      {/*
       * 8-column grid at md+. Tiles 1–4: col-span-2 each (fills row 1, 4×2=8).
       * Tiles 5–7: col-span-2 each, tile 5 starts at col 2 → 1 empty track on
       * each side (cols 1 and 8), centering the trio. Tile sizes identical to
       * row 1 since col-span-2 in grid-cols-8 = 1/4 of container.
       * Mobile (grid-cols-2): col-span-2 → col-span-1 via default auto-flow;
       * md:col-start-2 on tile 5 doesn't apply below md, so all 7 tiles
       * auto-place 2-per-row, tile 7 sits alone in col 1 final row.
       */}
      <div className="grid grid-cols-2 md:grid-cols-8 gap-4 md:gap-6">
        {CONTINENTS.slice(0, 4).map((c) => (
          <ContinentTile
            key={c.slug}
            continent={c}
            playfairClassName={playfairClassName}
            className="md:col-span-2"
          />
        ))}
        {CONTINENTS.slice(4).map((c, i) => (
          <ContinentTile
            key={c.slug}
            continent={c}
            playfairClassName={playfairClassName}
            className={`md:col-span-2${i === 0 ? " md:col-start-2" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
