"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { CONTINENT_CONFIGS } from "@/lib/continents";
import type { ContinentConfig } from "@/lib/continents";

// ── ContinentSilhouette ────────────────────────────────────────────────────────
// SVGs live at /public/svg/continents/{slug}.svg.
// Must be black silhouette on transparent background for CSS mask-image to work.
// If a file is missing the tile renders as a plain cream card — graceful fallback.

function ContinentSilhouette({ slug, color }: { slug: string; color: string }) {
  return (
    <div
      className="w-full"
      style={{
        aspectRatio: "4 / 3",
        backgroundColor: color,
        WebkitMaskImage: `url(/svg/continents/${slug}.svg)`,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",
        maskImage: `url(/svg/continents/${slug}.svg)`,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
      }}
      role="img"
      aria-label={`${slug} continent silhouette`}
    />
  );
}

// ── ContinentTile ──────────────────────────────────────────────────────────────

function ContinentTile({
  continent,
  playfairClassName,
  className = "",
}: {
  continent: ContinentConfig;
  playfairClassName: string;
  className?: string;
}) {
  const router = useRouter();
  const { slug, label, tagline, color } = continent;

  return (
    <button
      onClick={() => router.push(`/continents/${slug}`)}
      className={`group relative rounded-2xl overflow-hidden cursor-pointer text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg bg-[#FBF6EC] border border-[#E8DDC8] w-full ${className}`}
    >
      {/* Silhouette — top portion */}
      <ContinentSilhouette slug={slug} color={color} />

      {/* Arrow icon — top-right, reveals on hover */}
      <ArrowRight
        size={20}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ color }}
      />

      {/* Text block — below silhouette */}
      <div className="p-4 md:p-5 border-t border-[#E8DDC8]">
        <span className={`${playfairClassName} text-2xl md:text-3xl text-[#1B3A5C] block`}>
          {label}
        </span>
        <span className="text-sm md:text-base italic text-[#1B3A5C]/70 mt-1 block">
          {tagline}
        </span>
      </div>
    </button>
  );
}

// ── ContinentGrid ──────────────────────────────────────────────────────────────

export function ContinentGrid({ playfairClassName }: { playfairClassName: string }) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
      {/*
       * 8-column grid at md+. Tiles 1–4: col-span-2 each (fills row 1).
       * Tiles 5–7: col-span-2 each, tile 5 at col-start-2 → 1 empty track
       * on each side, centering the trio. Mobile (grid-cols-2): auto-flows
       * 2-per-row, tile 7 alone in col 1 of the final row.
       */}
      <div className="grid grid-cols-2 md:grid-cols-8 gap-4 md:gap-6">
        {CONTINENT_CONFIGS.slice(0, 4).map((c) => (
          <ContinentTile
            key={c.slug}
            continent={c}
            playfairClassName={playfairClassName}
            className="md:col-span-2"
          />
        ))}
        {CONTINENT_CONFIGS.slice(4).map((c, i) => (
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
