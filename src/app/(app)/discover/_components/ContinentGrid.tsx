"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { geoPath, geoMercator, geoAzimuthalEqualArea } from "d3-geo";
import { merge } from "topojson-client";
import type { Topology, GeometryCollection, Polygon, MultiPolygon } from "topojson-specification";
import worldAtlasData from "world-atlas/countries-110m.json";
import { CONTINENT_CONFIGS } from "@/lib/continents";
import type { ContinentConfig } from "@/lib/continents";

// ── Topology setup ─────────────────────────────────────────────────────────────

const topology = worldAtlasData as unknown as Topology<{ countries: GeometryCollection }>;
const allCountryGeoms = topology.objects.countries.geometries as unknown as (Polygon | MultiPolygon)[];

// ── Country ID → continent mapping (ISO 3166-1 numeric, from world-atlas) ────

const CONTINENT_IDS: Record<string, Set<string>> = {
  asia: new Set([
    "004","031","050","051","064","096","104","116","144","156","158","268","275",
    "360","364","368","376","392","398","400","408","410","418","422","458","462",
    "496","512","524","586","608","626","634","682","704","760","762","764","784",
    "792","795","860","887",
  ]),
  europe: new Set([
    "008","040","056","070","100","112","191","203","208","233","246","250","276",
    "300","304","348","352","372","380","428","440","442","498","499","528","578",
    "616","620","642","643","688","703","705","724","752","756","804","807","826",
  ]),
  africa: new Set([
    "012","024","072","108","120","140","148","178","180","204","226","231","232",
    "238","262","266","270","288","324","384","404","426","430","434","450","466",
    "478","504","508","516","562","566","624","646","686","694","706","710","716",
    "728","729","732","748","768","788","800","818","834","854","894",
  ]),
  "north-america": new Set([
    "044","084","124","188","192","214","222","304","320","332","340","388","484",
    "558","591","630","780","840",
  ]),
  "south-america": new Set([
    "032","068","076","152","170","218","238","328","600","604","740","858","862",
  ]),
  oceania: new Set([
    "036","090","242","540","548","554","598","776","798","882",
  ]),
  antarctica: new Set([
    "010","260",
  ]),
};

// ── City anchor dots [lng, lat] ────────────────────────────────────────────────

const CITY_DOTS: Record<string, [number, number][]> = {
  asia:           [[139.69,35.68],[100.50,13.75],[72.88,19.08],[103.82,1.35],[126.98,37.57]],
  europe:         [[-0.13,51.51],[2.35,48.86],[12.50,41.90],[2.17,41.39],[28.98,41.01]],
  africa:         [[31.25,30.05],[18.42,-33.92],[-8.01,31.63],[36.82,-1.29],[3.38,6.52]],
  "north-america":[[-74.01,40.71],[-118.24,34.05],[-99.13,19.43],[-86.85,21.16],[-79.38,43.65]],
  "south-america":[[-43.17,-22.91],[-58.38,-34.61],[-77.04,-12.05],[-71.98,-13.53],[-70.67,-33.45]],
  oceania:        [[151.21,-33.87],[174.76,-36.85],[-157.86,21.31],[178.44,-18.14],[168.66,-45.03]],
  antarctica:     [],
};

// ── Pre-compute SVG path + dot positions per continent (module-level, once) ───

const VIEW_W = 300;
const VIEW_H = 280;

type ContinentSVG = { pathD: string; dots: [number, number][] };
const CONTINENT_SVG: Record<string, ContinentSVG> = {};

for (const c of CONTINENT_CONFIGS) {
  const ids = CONTINENT_IDS[c.slug];
  const matching = allCountryGeoms.filter(
    g => ids?.has(String((g as unknown as { id?: string }).id ?? ""))
  );

  if (matching.length === 0) {
    CONTINENT_SVG[c.slug] = { pathD: "", dots: [] };
    continue;
  }

  const merged = merge(
    topology as unknown as Topology,
    matching as (Polygon | MultiPolygon)[]
  );

  const projection = c.slug === "antarctica"
    ? geoAzimuthalEqualArea().rotate([0, 90])
    : geoMercator();

  // fitSize auto-scales the projection to fill VIEW_W × VIEW_H exactly
  projection.fitSize([VIEW_W, VIEW_H], merged as Parameters<typeof projection.fitSize>[1]);

  const pathGen = geoPath(projection);
  const pathD = pathGen(merged as Parameters<typeof pathGen>[0]) ?? "";

  const dots = (CITY_DOTS[c.slug] ?? [])
    .map(([lng, lat]) => projection([lng, lat]))
    .filter((p): p is [number, number] => p !== null);

  CONTINENT_SVG[c.slug] = { pathD, dots };
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
  const { pathD, dots } = CONTINENT_SVG[slug] ?? { pathD: "", dots: [] };

  return (
    <button
      onClick={() => router.push(`/continents/${slug}`)}
      className={`group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg bg-[#FBF6EC] border border-[#E8DDC8] w-full ${className}`}
    >
      {/* Silhouette SVG — top 70% of tile */}
      {pathD && (
        <div className="absolute inset-0">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="w-full h-[70%]"
            preserveAspectRatio="xMidYMid meet"
          >
            <path d={pathD} fill={color} stroke="#FBF6EC" strokeWidth={0.5} />
            {dots.map(([cx, cy], i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={3}
                fill="#1B3A5C"
                stroke="#FBF6EC"
                strokeWidth={1}
              />
            ))}
          </svg>
        </div>
      )}

      {/* Arrow icon — top-right, reveals on hover */}
      <ArrowRight
        size={20}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ color }}
      />

      {/* Text block — bottom 30% */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
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
