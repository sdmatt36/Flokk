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
// Oceania: trimmed to contiguous Pacific — excludes Tonga/Tuvalu/Samoa (far-flung, blow bbox)
// Europe: excludes Russia (643) — its eastern extent smears the silhouette unusably wide

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
    "616","620","642","688","703","705","724","752","756","804","807","826",
  ]),
  africa: new Set([
    "012","024","072","108","120","140","148","178","180","204","226","231","232",
    "238","262","266","270","288","324","384","404","426","430","434","450","466",
    "478","504","508","516","562","566","624","646","686","694","706","710","716",
    "728","729","732","748","768","788","800","818","834","854","894",
  ]),
  "north-america": new Set([
    "044","084","124","188","192","214","222","320","332","340","388","484",
    "558","591","630","780","840",
  ]),
  "south-america": new Set([
    "032","068","076","152","170","218","238","328","600","604","740","858","862",
  ]),
  oceania: new Set([
    "036","090","242","540","548","554","598",
  ]),
  antarctica: new Set([
    "010","260",
  ]),
};

// ── City anchors with labels ────────────────────────────────────────────────────

const CITIES: Record<string, Array<{ name: string; lng: number; lat: number }>> = {
  asia: [
    { name: "Tokyo",     lng: 139.69, lat:  35.68 },
    { name: "Bangkok",   lng: 100.50, lat:  13.75 },
    { name: "Mumbai",    lng:  72.88, lat:  19.08 },
    { name: "Singapore", lng: 103.82, lat:   1.35 },
    { name: "Seoul",     lng: 126.98, lat:  37.57 },
  ],
  europe: [
    { name: "London",    lng:  -0.13, lat:  51.51 },
    { name: "Paris",     lng:   2.35, lat:  48.86 },
    { name: "Rome",      lng:  12.50, lat:  41.90 },
    { name: "Barcelona", lng:   2.17, lat:  41.39 },
    { name: "Istanbul",  lng:  28.98, lat:  41.01 },
  ],
  africa: [
    { name: "Cairo",     lng:  31.25, lat:  30.05 },
    { name: "Cape Town", lng:  18.42, lat: -33.92 },
    { name: "Casablanca",lng:  -8.01, lat:  31.63 },
    { name: "Nairobi",   lng:  36.82, lat:  -1.29 },
    { name: "Lagos",     lng:   3.38, lat:   6.52 },
  ],
  "north-america": [
    { name: "New York",     lng: -74.01, lat:  40.71 },
    { name: "Los Angeles",  lng: -118.24, lat:  34.05 },
    { name: "Mexico City",  lng: -99.13,  lat:  19.43 },
    { name: "Cancún",       lng: -86.85,  lat:  21.16 },
    { name: "Toronto",      lng: -79.38,  lat:  43.65 },
  ],
  "south-america": [
    { name: "Rio",          lng: -43.17, lat: -22.91 },
    { name: "Buenos Aires", lng: -58.38, lat: -34.61 },
    { name: "Lima",         lng: -77.04, lat: -12.05 },
    { name: "Cusco",        lng: -71.98, lat: -13.53 },
    { name: "Santiago",     lng: -70.67, lat: -33.45 },
  ],
  oceania: [
    { name: "Sydney",     lng: 151.21, lat: -33.87 },
    { name: "Auckland",   lng: 174.76, lat: -36.85 },
    { name: "Brisbane",   lng: 153.03, lat: -27.47 },
    { name: "Suva",       lng: 178.44, lat: -18.14 },
    { name: "Queenstown", lng: 168.66, lat: -45.03 },
  ],
  antarctica: [],
};

// ── Pre-compute SVG path + city positions per continent (module-level, once) ───

const VIEW_W = 300;
const VIEW_H = 280;
const PAD    = 20;

type CityDot = { x: number; y: number; name: string };
type ContinentSVG = { pathD: string; cities: CityDot[] };
const CONTINENT_SVG: Record<string, ContinentSVG> = {};

for (const c of CONTINENT_CONFIGS) {
  const ids = CONTINENT_IDS[c.slug];
  const matching = allCountryGeoms.filter(
    g => ids?.has(String((g as unknown as { id?: string }).id ?? ""))
  );

  if (matching.length === 0) {
    CONTINENT_SVG[c.slug] = { pathD: "", cities: [] };
    continue;
  }

  const merged = merge(
    topology as unknown as Topology,
    matching as (Polygon | MultiPolygon)[]
  );

  const projection = c.slug === "antarctica"
    ? geoAzimuthalEqualArea().rotate([0, 90])
    : geoMercator();

  projection.fitExtent([[PAD, PAD], [VIEW_W - PAD, VIEW_H - PAD]], merged as Parameters<typeof projection.fitSize>[1]);

  const pathGen = geoPath(projection);
  const pathD = pathGen(merged as Parameters<typeof pathGen>[0]) ?? "";

  const cities = (CITIES[c.slug] ?? [])
    .map(({ name, lng, lat }) => {
      const pt = projection([lng, lat]);
      if (!pt) return null;
      return { x: pt[0], y: pt[1], name };
    })
    .filter((p): p is CityDot => p !== null);

  CONTINENT_SVG[c.slug] = { pathD, cities };
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
  const { pathD, cities } = CONTINENT_SVG[slug] ?? { pathD: "", cities: [] };

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
            {cities.map(({ x, y, name }, i) => (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y}
                  r={3}
                  fill="#1B3A5C"
                  stroke="#FBF6EC"
                  strokeWidth={1}
                />
                <text
                  x={x + 6}
                  y={y + 3}
                  fontSize={9}
                  fill="#1B3A5C"
                  fontFamily="sans-serif"
                  fontWeight={500}
                >
                  {name}
                </text>
              </g>
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
