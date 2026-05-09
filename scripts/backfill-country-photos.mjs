// Backfills Country.photoUrl, photoCredit, photoSearchQuery, photoSourceUrl
// using the Unsplash Search API with curated per-country queries.
//
// Rate limit: Unsplash free tier = 50 requests/hour.
// Delay: 75s between calls → ~48 calls/hour, safely under the limit.
// Idempotent: skips countries that already have photoUrl set.
//
// Run modes:
//   node scripts/backfill-country-photos.mjs                  # full run
//   node scripts/backfill-country-photos.mjs --slugs france,india,egypt  # smoke test
//   LIMIT=10 node scripts/backfill-country-photos.mjs         # first N by name
//
// Slug mismatch report (validated against 220 DB slugs):
//   "cape-verde" from the original curated map → DB slug is "cabo-verde" (fixed below)
//   All other curated slugs match DB slugs exactly.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const UNSPLASH_KEY = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY ?? "";
const DELAY_MS = 75_000; // 75s → ~48 calls/hour, under Unsplash free 50/hour

if (!UNSPLASH_KEY) {
  console.error("ERROR: NEXT_PUBLIC_UNSPLASH_ACCESS_KEY is not set.");
  process.exit(1);
}

// ── Curated query map (slug → query) ────────────────────────────────────────
// "cape-verde" corrected to "cabo-verde" (DB slug mismatch fixed)

const CURATED_QUERIES = {
  // Asia
  "bangladesh": "Sundarbans Bangladesh",
  "cambodia": "Angkor Wat",
  "china": "Great Wall of China",
  "india": "Taj Mahal sunrise",
  "iran": "Isfahan Iran mosque",
  "israel": "Jerusalem old city",
  "japan": "Mount Fuji Japan",
  "jordan": "Petra Jordan",
  "kazakhstan": "Astana skyline",
  "lebanon": "Beirut skyline",
  "malaysia": "Petronas Towers Kuala Lumpur",
  "nepal": "Mount Everest Himalaya",
  "north-korea": "Pyongyang skyline",
  "palestine": "Bethlehem Palestine",
  "philippines": "Palawan Philippines El Nido",
  "vietnam": "Ha Long Bay Vietnam",
  // Europe
  "albania": "Albanian Alps",
  "croatia": "Dubrovnik Croatia",
  "cyprus": "Cyprus coastline",
  "czech-republic": "Prague Charles Bridge",
  "denmark": "Copenhagen Nyhavn",
  "france": "Paris Eiffel Tower cityscape",
  "germany": "Neuschwanstein Castle",
  "gibraltar": "Rock of Gibraltar",
  "greece": "Santorini Greece",
  "guernsey": "Guernsey island coastline",
  "iceland": "Iceland waterfall landscape",
  "ireland": "Cliffs of Moher Ireland",
  "isle-of-man": "Isle of Man coastline",
  "italy": "Colosseum Rome",
  "latvia": "Riga old town",
  "montenegro": "Bay of Kotor Montenegro",
  "netherlands": "Amsterdam canals windmills",
  "poland": "Warsaw old town",
  "portugal": "Lisbon Portugal",
  "romania": "Transylvania Romania mountains",
  "russia": "St Petersburg Russia",
  "san-marino": "San Marino mountain",
  "serbia": "Belgrade skyline",
  "slovakia": "High Tatras Slovakia",
  "slovenia": "Lake Bled Slovenia",
  "spain": "Sagrada Familia Barcelona",
  "sweden": "Stockholm Sweden archipelago",
  "switzerland": "Swiss Alps Matterhorn",
  "turkey": "Hagia Sophia Istanbul",
  "united-kingdom": "Big Ben London",
  "scotland": "Edinburgh skyline castle",
  "wales": "Wales castle countryside",
  "northern-ireland": "Giants Causeway Northern Ireland",
  // Africa
  "botswana": "Okavango Delta Botswana",
  "burkina-faso": "Burkina Faso landscape",
  "burundi": "Burundi landscape",
  "cabo-verde": "Cape Verde beach",   // DB slug is "cabo-verde", not "cape-verde"
  "cameroon": "Cameroon landscape",
  "central-african-republic": "Central African Republic forest",
  "chad": "Chad desert landscape",
  "comoros": "Comoros island",
  "democratic-republic-of-the-congo": "Congo rainforest",
  "egypt": "Pyramids of Giza",
  "eritrea": "Eritrea landscape",
  "ethiopia": "Ethiopia highlands",
  "gabon": "Gabon rainforest",
  "gambia": "Gambia river",
  "ghana": "Ghana wildlife",
  "guinea": "Conakry Guinea",
  "guinea-bissau": "Guinea-Bissau landscape",
  "kenya": "Kenya safari elephants",
  "lesotho": "Lesotho mountains",
  "liberia": "Liberia coast",
  "madagascar": "Madagascar baobab trees",
  "malawi": "Lake Malawi",
  "mauritania": "Mauritania desert",
  "mauritius": "Mauritius beach",
  "morocco": "Morocco Sahara desert camels",
  "mozambique": "Mozambique beach",
  "namibia": "Namibia Sossusvlei dunes",
  "tanzania": "Tanzania Serengeti",
  "togo": "Togo coast",
  "tunisia": "Tunisia Sahara",
  "uganda": "Uganda mountain gorilla",
  "zambia": "Victoria Falls Zambia",
  "zimbabwe": "Victoria Falls Zimbabwe",
  // North America + Caribbean
  "belize": "Belize Blue Hole",
  "bermuda": "Bermuda beach",
  "british-virgin-islands": "British Virgin Islands sailing",
  "canada": "Banff Lake Louise Canada",
  "cayman-islands": "Cayman Islands beach",
  "costa-rica": "Costa Rica rainforest waterfall",
  "cuba": "Havana Cuba colorful streets",
  "dominican-republic": "Punta Cana Dominican Republic",
  "el-salvador": "El Salvador volcano",
  "guatemala": "Tikal Guatemala",
  "jamaica": "Jamaica beach",
  "mexico": "Chichen Itza Mexico",
  "montserrat": "Montserrat island",
  "panama": "Panama Canal skyline",
  "saint-kitts-and-nevis": "Saint Kitts beach",
  "saint-lucia": "Saint Lucia Pitons",
  "sint-maarten": "Sint Maarten beach",
  "trinidad-and-tobago": "Tobago beach",
  "united-states": "Grand Canyon Arizona",
  // South America
  "argentina": "Buenos Aires Argentina",
  "brazil": "Christ the Redeemer Rio de Janeiro",
  "chile": "Patagonia Chile Torres del Paine",
  "colombia": "Medellin Colombia",
  "ecuador": "Galapagos Islands",
  "falkland-islands": "Falkland Islands penguins",
  "french-guiana": "French Guiana rainforest",
  "guyana": "Kaieteur Falls Guyana",
  "peru": "Machu Picchu Peru",
  "suriname": "Suriname rainforest",
  "uruguay": "Punta del Este Uruguay",
  "venezuela": "Angel Falls Venezuela",
  // Oceania
  "australia": "Sydney Opera House",
  "fiji": "Fiji islands beach",
  "micronesia": "Micronesia island lagoon",
  "nauru": "Nauru Pacific island",
  "new-zealand": "Milford Sound New Zealand",
  "palau": "Palau Rock Islands",
  "samoa": "Samoa beach",
  "solomon-islands": "Solomon Islands beach",
  "tonga": "Tonga island",
  "vanuatu": "Vanuatu beach",
  // Antarctica
  "antarctica": "Antarctica penguins iceberg",
};

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const slugsArgRaw = args.find(a => a.startsWith("--slugs="))?.slice(8)
  ?? (args.indexOf("--slugs") !== -1 ? args[args.indexOf("--slugs") + 1] : null);
const slugFilter = slugsArgRaw ? new Set(slugsArgRaw.split(",").map(s => s.trim())) : null;
const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;

// ── DB setup ─────────────────────────────────────────────────────────────────

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// ── Validate curated slugs against DB ────────────────────────────────────────

const allSlugs = (await db.country.findMany({ select: { slug: true } })).map(c => c.slug);
const dbSlugSet = new Set(allSlugs);
const curatedMismatches = Object.keys(CURATED_QUERIES).filter(s => !dbSlugSet.has(s));
if (curatedMismatches.length > 0) {
  console.warn(`\nWARN: Curated map keys not found in DB: ${curatedMismatches.join(", ")}`);
  console.warn("These will be skipped. Fix the slug before a full run.\n");
} else {
  console.log("Curated map: all slugs validated against DB ✓");
}

// ── Fetch countries to process ────────────────────────────────────────────────

const where = {
  photoUrl: null,
  ...(slugFilter ? { slug: { in: [...slugFilter] } } : {}),
};

const countries = await db.country.findMany({
  where,
  select: { id: true, slug: true, name: true },
  orderBy: { name: "asc" },
  ...(limit ? { take: limit } : {}),
});

const total = countries.length;
if (total === 0) {
  console.log("No countries to process (all have photoUrl or no match).");
  await db.$disconnect();
  await pool.end();
  process.exit(0);
}

console.log(`Countries to process: ${total}${slugFilter ? ` (--slugs filter)` : ""}${limit ? ` (LIMIT=${limit})` : ""}`);

// ── Unsplash fetch (inline — scripts can't import TS) ─────────────────────────

async function fetchUnsplashPhoto(query) {
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&client_id=${UNSPLASH_KEY}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const result = data.results?.[0];
  if (!result) return null;
  return {
    url: result.urls.regular,
    credit: `Photo by ${result.user.name} on Unsplash`,
    sourceUrl: result.links.html,
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Main loop ─────────────────────────────────────────────────────────────────

let succeeded = 0;
let nulls = 0;
let errors = 0;

for (let i = 0; i < countries.length; i++) {
  const country = countries[i];
  const query = CURATED_QUERIES[country.slug] ?? `${country.name} scenic landscape`;

  try {
    const photo = await fetchUnsplashPhoto(query);
    if (photo) {
      await db.country.update({
        where: { id: country.id },
        data: {
          photoUrl: photo.url,
          photoCredit: photo.credit,
          photoSourceUrl: photo.sourceUrl,
          photoSearchQuery: query,
        },
      });
      succeeded++;
      console.log(`  OK  [${i + 1}/${total}] ${country.name} (${country.slug}) → ${photo.url.slice(0, 70)}...`);
      console.log(`       credit: ${photo.credit}`);
    } else {
      nulls++;
      console.log(`  NULL [${i + 1}/${total}] ${country.name} — no Unsplash result for "${query}"`);
    }
  } catch (err) {
    errors++;
    console.error(`  ERR [${i + 1}/${total}] ${country.name}: ${err.message}`);
  }

  if ((i + 1) % 10 === 0) {
    console.log(`\n[${i + 1}/${total}] checkpoint — ${succeeded} OK, ${nulls} null, ${errors} errors\n`);
  }

  if (i < countries.length - 1) await sleep(DELAY_MS);
}

await db.$disconnect();
await pool.end();

console.log(`\n=== Done ===`);
console.log(`Processed: ${total} | Succeeded: ${succeeded} | Null: ${nulls} | Errors: ${errors}`);
console.log(`Est. time per call: ~75s (Unsplash free tier rate limit)`);
