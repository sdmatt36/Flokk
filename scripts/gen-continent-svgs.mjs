// Generates 7 continent silhouette SVGs into public/svg/continents/.
// Black fill, transparent background, single <path>. Used as CSS mask sources by ContinentSilhouette (commit d9332ba).
// To re-run: npm install --no-save world-atlas d3-geo topojson-client && node scripts/gen-continent-svgs.mjs
import fs from "node:fs";
import path from "node:path";
import { geoMercator, geoAzimuthalEqualArea, geoPath, geoCentroid } from "d3-geo";
import { feature } from "topojson-client";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const topology = require("world-atlas/countries-110m.json");

const allGeoms = topology.objects.countries.geometries;

const CONTINENTS = [
  { slug: "asia", projection: "mercator", bbox: [25, -12, 180, 60],
    ids: ["004","031","050","051","064","096","104","116","144","156","158","268","275","356","360","364","368","376","392","398","400","408","410","414","417","418","422","458","496","512","524","586","608","626","634","682","704","760","762","764","784","792","795","860","887"] },
  { slug: "europe", projection: "mercator", bbox: [-25, 34, 45, 71],
    ids: ["008","040","056","070","100","112","191","203","208","233","246","250","276","300","348","352","372","380","428","440","442","498","499","528","578","616","620","642","688","703","705","724","752","756","804","807","826"] },
  { slug: "africa", projection: "mercator", bbox: [-20, -36, 55, 38],
    ids: ["012","024","072","108","120","140","148","178","180","204","226","231","232","262","266","270","288","324","384","404","426","430","434","450","454","466","478","504","508","516","562","566","624","646","686","694","706","710","716","728","729","732","748","768","788","800","818","834","854","894"] },
  { slug: "north-america", projection: "mercator", bbox: [-170, 7, -50, 75],
    ids: ["044","084","124","188","192","214","222","320","332","340","388","484","558","591","630","780","840"] },
  { slug: "south-america", projection: "mercator", bbox: [-92, -58, -30, 14],
    ids: ["032","068","076","152","170","218","238","328","600","604","740","858","862"] },
  { slug: "oceania", projection: "mercator", bbox: [110, -47, 180, -10],
    ids: ["036","554","598"] },
  { slug: "antarctica", projection: "azimuthal-south", bbox: [-180, -90, 180, -60],
    ids: ["010"] },
];

const VIEW_W = 800, VIEW_H = 600, PAD = 20;
const outDir = path.resolve("public/svg/continents");
fs.mkdirSync(outDir, { recursive: true });

function clipGeom(geom, bbox) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const inBox = (lng, lat) => lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
  if (geom.type === "Polygon") {
    const [lng, lat] = geoCentroid({ type: "Feature", geometry: geom, properties: {} });
    return inBox(lng, lat) ? geom : null;
  }
  if (geom.type === "MultiPolygon") {
    const kept = geom.coordinates.filter(c => {
      const [lng, lat] = geoCentroid({ type: "Feature", geometry: { type: "Polygon", coordinates: c }, properties: {} });
      return inBox(lng, lat);
    });
    if (kept.length === 0) return null;
    if (kept.length === 1) return { type: "Polygon", coordinates: kept[0] };
    return { type: "MultiPolygon", coordinates: kept };
  }
  return geom;
}

for (const c of CONTINENTS) {
  const ids = new Set(c.ids);
  const matching = allGeoms.filter(g => ids.has(String(g.id)));
  const features = matching.map(g => feature(topology, g));
  const clipped = features.map(f => clipGeom(f.geometry, c.bbox)).filter(Boolean);
  const allCoords = [];
  for (const g of clipped) {
    if (g.type === "Polygon") allCoords.push(g.coordinates);
    else if (g.type === "MultiPolygon") allCoords.push(...g.coordinates);
  }
  const combined = { type: "Feature", geometry: { type: "MultiPolygon", coordinates: allCoords }, properties: {} };
  const projection = c.projection === "azimuthal-south"
    ? geoAzimuthalEqualArea().rotate([0, 90])
    : geoMercator();
  projection.fitExtent([[PAD, PAD], [VIEW_W - PAD, VIEW_H - PAD]], combined);
  const d = geoPath(projection)(combined);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}">\n  <path d="${d}" fill="#000000"/>\n</svg>`;
  fs.writeFileSync(path.join(outDir, `${c.slug}.svg`), svg);
  console.log(`OK ${c.slug}`);
}
