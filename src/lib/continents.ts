// Country-to-continent lookup for Flokk Spots hierarchy.
// Continent is NOT stored on CommunitySpot. It's computed from country at render time.
// Matt-approved judgment calls: Russia → Europe, Turkey → Europe, Egypt → Africa.

// ── Discover grid config ──────────────────────────────────────────────────────
// Used by ContinentGrid.tsx and /continents/[slug]/page.tsx (Discipline 4.50)

export type ContinentConfig = {
  slug: string;
  label: string;
  tagline: string;
  color: string;
};

export const CONTINENT_CONFIGS: ContinentConfig[] = [
  { slug: "asia",          label: "Asia",          tagline: "Temples at dawn, noodles at midnight.",          color: "#B14A3A" },
  { slug: "europe",        label: "Europe",        tagline: "Every train ride leads to a story.",             color: "#C49454" },
  { slug: "africa",        label: "Africa",        tagline: "Where the kids stop talking and just look.",     color: "#C77F2A" },
  { slug: "north-america", label: "North America", tagline: "Pack the car, find the road.",                   color: "#3C6A78" },
  { slug: "south-america", label: "South America", tagline: "High peaks, low jungles, long lunches.",         color: "#5C7E94" },
  { slug: "oceania",       label: "Oceania",       tagline: "Where the road ends, the water starts.",         color: "#2E6B6F" },
  { slug: "antarctica",    label: "Antarctica",    tagline: "Start in Ushuaia. Tell your flokk how it ended.", color: "#7A8B9C" },
];

// ── Spots-hierarchy continent type ───────────────────────────────────────────

export type Continent =
  | "Africa"
  | "Asia"
  | "Europe"
  | "North America"
  | "South America"
  | "Oceania"
  | "Antarctica";

export const COUNTRY_TO_CONTINENT: Record<string, Continent> = {
  // ── Africa ──────────────────────────────────────────────────────────────────
  "Algeria": "Africa",
  "Angola": "Africa",
  "Benin": "Africa",
  "Botswana": "Africa",
  "Burkina Faso": "Africa",
  "Burundi": "Africa",
  "Cabo Verde": "Africa",
  "Cameroon": "Africa",
  "Central African Republic": "Africa",
  "Chad": "Africa",
  "Comoros": "Africa",
  "Democratic Republic of the Congo": "Africa",
  "Republic of the Congo": "Africa",
  "Djibouti": "Africa",
  "Egypt": "Africa",
  "Equatorial Guinea": "Africa",
  "Eritrea": "Africa",
  "Eswatini": "Africa",
  "Ethiopia": "Africa",
  "Gabon": "Africa",
  "Gambia": "Africa",
  "Ghana": "Africa",
  "Guinea": "Africa",
  "Guinea-Bissau": "Africa",
  "Kenya": "Africa",
  "Lesotho": "Africa",
  "Liberia": "Africa",
  "Libya": "Africa",
  "Madagascar": "Africa",
  "Malawi": "Africa",
  "Mali": "Africa",
  "Mauritania": "Africa",
  "Mauritius": "Africa",
  "Morocco": "Africa",
  "Mozambique": "Africa",
  "Namibia": "Africa",
  "Niger": "Africa",
  "Nigeria": "Africa",
  "Rwanda": "Africa",
  "Saint Helena": "Africa",
  "São Tomé and Príncipe": "Africa",
  "Senegal": "Africa",
  "Seychelles": "Africa",
  "Sierra Leone": "Africa",
  "Somalia": "Africa",
  "South Africa": "Africa",
  "South Sudan": "Africa",
  "Sudan": "Africa",
  "Tanzania": "Africa",
  "Togo": "Africa",
  "Tunisia": "Africa",
  "Uganda": "Africa",
  "Zambia": "Africa",
  "Zimbabwe": "Africa",
  "Côte d'Ivoire": "Africa",

  // ── Asia ────────────────────────────────────────────────────────────────────
  "Afghanistan": "Asia",
  "Armenia": "Asia",
  "Azerbaijan": "Asia",
  "Bahrain": "Asia",
  "Bangladesh": "Asia",
  "Bhutan": "Asia",
  "Brunei": "Asia",
  "Cambodia": "Asia",
  "China": "Asia",
  "Cyprus": "Europe",
  "Georgia": "Asia",
  "India": "Asia",
  "Indonesia": "Asia",
  "Iran": "Asia",
  "Iraq": "Asia",
  "Israel": "Asia",
  "Japan": "Asia",
  "Jordan": "Asia",
  "Kazakhstan": "Asia",
  "Kuwait": "Asia",
  "Kyrgyzstan": "Asia",
  "Laos": "Asia",
  "Lebanon": "Asia",
  "Malaysia": "Asia",
  "Maldives": "Asia",
  "Mongolia": "Asia",
  "Myanmar": "Asia",
  "Nepal": "Asia",
  "North Korea": "Asia",
  "Oman": "Asia",
  "Pakistan": "Asia",
  "Palestine": "Asia",
  "Philippines": "Asia",
  "Qatar": "Asia",
  "Saudi Arabia": "Asia",
  "Singapore": "Asia",
  "South Korea": "Asia",
  "Sri Lanka": "Asia",
  "Syria": "Asia",
  "Taiwan": "Asia",
  "Tajikistan": "Asia",
  "Thailand": "Asia",
  "Timor-Leste": "Asia",
  "Turkey": "Europe",
  "Turkmenistan": "Asia",
  "United Arab Emirates": "Asia",
  "Uzbekistan": "Asia",
  "Vietnam": "Asia",
  "Yemen": "Asia",

  // ── Europe ──────────────────────────────────────────────────────────────────
  "Albania": "Europe",
  "Andorra": "Europe",
  "Austria": "Europe",
  "Belarus": "Europe",
  "Belgium": "Europe",
  "Bosnia and Herzegovina": "Europe",
  "Bulgaria": "Europe",
  "Croatia": "Europe",
  "Czech Republic": "Europe",
  "Denmark": "Europe",
  "Estonia": "Europe",
  "Finland": "Europe",
  "France": "Europe",
  "Germany": "Europe",
  "Gibraltar": "Europe",
  "Greece": "Europe",
  "Guernsey": "Europe",
  "Hungary": "Europe",
  "Iceland": "Europe",
  "Ireland": "Europe",
  "Isle of Man": "Europe",
  "Italy": "Europe",
  "Jersey": "Europe",
  "Kosovo": "Europe",
  "Latvia": "Europe",
  "Liechtenstein": "Europe",
  "Lithuania": "Europe",
  "Luxembourg": "Europe",
  "Malta": "Europe",
  "Moldova": "Europe",
  "Monaco": "Europe",
  "Montenegro": "Europe",
  "Netherlands": "Europe",
  "North Macedonia": "Europe",
  "Norway": "Europe",
  "Poland": "Europe",
  "Portugal": "Europe",
  "Romania": "Europe",
  "Russia": "Europe",
  "San Marino": "Europe",
  "Serbia": "Europe",
  "Slovakia": "Europe",
  "Slovenia": "Europe",
  "Spain": "Europe",
  "Sweden": "Europe",
  "Switzerland": "Europe",
  "Ukraine": "Europe",
  "United Kingdom": "Europe",
  "Vatican City": "Europe",

  // ── North America ───────────────────────────────────────────────────────────
  "Anguilla": "North America",
  "Antigua and Barbuda": "North America",
  "Aruba": "North America",
  "Bahamas": "North America",
  "Barbados": "North America",
  "Belize": "North America",
  "Bermuda": "North America",
  "Bonaire": "North America",
  "British Virgin Islands": "North America",
  "Canada": "North America",
  "Cayman Islands": "North America",
  "Costa Rica": "North America",
  "Cuba": "North America",
  "Curaçao": "North America",
  "Dominica": "North America",
  "Dominican Republic": "North America",
  "El Salvador": "North America",
  "Grenada": "North America",
  "Guatemala": "North America",
  "Haiti": "North America",
  "Honduras": "North America",
  "Jamaica": "North America",
  "Mexico": "North America",
  "Montserrat": "North America",
  "Nicaragua": "North America",
  "Panama": "North America",
  "Saint Kitts and Nevis": "North America",
  "Saint Lucia": "North America",
  "Saint Vincent and the Grenadines": "North America",
  "Sint Maarten": "North America",
  "Trinidad and Tobago": "North America",
  "Turks and Caicos Islands": "North America",
  "United States": "North America",

  // ── South America ───────────────────────────────────────────────────────────
  "Argentina": "South America",
  "Bolivia": "South America",
  "Brazil": "South America",
  "Chile": "South America",
  "Colombia": "South America",
  "Ecuador": "South America",
  "Falkland Islands": "South America",
  "French Guiana": "South America",
  "Guyana": "South America",
  "Paraguay": "South America",
  "Peru": "South America",
  "Suriname": "South America",
  "Uruguay": "South America",
  "Venezuela": "South America",

  // ── Oceania ─────────────────────────────────────────────────────────────────
  "Australia": "Oceania",
  "Fiji": "Oceania",
  "Kiribati": "Oceania",
  "Marshall Islands": "Oceania",
  "Micronesia": "Oceania",
  "Nauru": "Oceania",
  "New Zealand": "Oceania",
  "Palau": "Oceania",
  "Papua New Guinea": "Oceania",
  "Pitcairn Islands": "Oceania",
  "Samoa": "Oceania",
  "Solomon Islands": "Oceania",
  "Tonga": "Oceania",
  "Tuvalu": "Oceania",
  "Vanuatu": "Oceania",

  // ── Antarctica ──────────────────────────────────────────────────────────────
  "Antarctica": "Antarctica",
  "South Georgia": "Antarctica",
};

// Common aliases normalized to canonical country names used above.
const ALIASES: Record<string, string> = {
  "usa": "United States",
  "us": "United States",
  "u.s.": "United States",
  "u.s.a.": "United States",
  "united states of america": "United States",
  "america": "United States",
  "uk": "United Kingdom",
  "u.k.": "United Kingdom",
  "britain": "United Kingdom",
  "great britain": "United Kingdom",
  "england": "United Kingdom",
  "scotland": "United Kingdom",
  "wales": "United Kingdom",
  "south korea": "South Korea",
  "s korea": "South Korea",
  "s. korea": "South Korea",
  "korea south": "South Korea",
  "republic of korea": "South Korea",
  "north korea": "North Korea",
  "n korea": "North Korea",
  "n. korea": "North Korea",
  "korea north": "North Korea",
  "dprk": "North Korea",
  "czechia": "Czech Republic",
  "czech": "Czech Republic",
  "burma": "Myanmar",
  "holland": "Netherlands",
  "the netherlands": "Netherlands",
  "vatican": "Vatican City",
  "holy see": "Vatican City",
  "east timor": "Timor-Leste",
  "ivory coast": "Côte d'Ivoire",
  "cote d'ivoire": "Côte d'Ivoire",
  "cape verde": "Cabo Verde",
  "swaziland": "Eswatini",
  "macedonia": "North Macedonia",
  "taiwan, province of china": "Taiwan",
  "hong kong": "China",
  "macao": "China",
  "macau": "China",
  "iran, islamic republic of": "Iran",
  "syria, arab republic of": "Syria",
  "bolivia, plurinational state of": "Bolivia",
  "venezuela, bolivarian republic of": "Venezuela",
  "tanzania, united republic of": "Tanzania",
  "congo": "Republic of the Congo",
  "dr congo": "Democratic Republic of the Congo",
  "drc": "Democratic Republic of the Congo",
  "zaire": "Democratic Republic of the Congo",
  "palestine, state of": "Palestine",
  "west bank": "Palestine",
  "gaza": "Palestine",
  "brunei darussalam": "Brunei",
  "lao pdr": "Laos",
  "lao": "Laos",
  "viet nam": "Vietnam",
  "timor leste": "Timor-Leste",
  "trinidad & tobago": "Trinidad and Tobago",
  "saint kitts & nevis": "Saint Kitts and Nevis",
  "saint vincent & the grenadines": "Saint Vincent and the Grenadines",
  "antigua & barbuda": "Antigua and Barbuda",
  "bosnia & herzegovina": "Bosnia and Herzegovina",
  "sao tome and principe": "São Tomé and Príncipe",
  "uae": "United Arab Emirates",
};

export function getContinent(country: string | null | undefined): Continent | null {
  if (!country) return null;
  const trimmed = country.trim();
  if (!trimmed) return null;

  // Direct lookup (exact match — handles canonical names like "Japan", "United States")
  if (COUNTRY_TO_CONTINENT[trimmed]) return COUNTRY_TO_CONTINENT[trimmed];

  // Alias lookup (lowercase normalized)
  const lower = trimmed.toLowerCase();
  const canonical = ALIASES[lower];
  if (canonical && COUNTRY_TO_CONTINENT[canonical]) return COUNTRY_TO_CONTINENT[canonical];

  // Case-insensitive scan of COUNTRY_TO_CONTINENT keys as last resort
  for (const key of Object.keys(COUNTRY_TO_CONTINENT)) {
    if (key.toLowerCase() === lower) return COUNTRY_TO_CONTINENT[key];
  }

  return null;
}

export function listCountries(continent: Continent): string[] {
  return Object.entries(COUNTRY_TO_CONTINENT)
    .filter(([, c]) => c === continent)
    .map(([country]) => country)
    .sort();
}

export function listContinents(): Continent[] {
  return ["Asia", "Europe", "North America", "South America", "Africa", "Oceania", "Antarctica"];
}

/* istanbul ignore next */
// Sanity (paste into a scratch file to verify):
// console.log(getContinent('USA'));           // 'North America'
// console.log(getContinent('japan'));         // 'Asia'
// console.log(getContinent('Xanadu'));        // null
// console.log(getContinent('Turkey'));        // 'Europe'
// console.log(getContinent('Russia'));        // 'Europe'
// console.log(getContinent('Egypt'));         // 'Africa'
// console.log(getContinent('uk'));            // 'Europe'
// console.log(getContinent('Czechia'));       // 'Europe'
// console.log(getContinent('South Korea'));   // 'Asia'
// console.log(getContinent('Panama'));        // 'North America'
// console.log(getContinent('Guyana'));        // 'South America'
// console.log(getContinent('Cyprus'));        // 'Europe'
// console.log(getContinent('Armenia'));       // 'Asia'
// console.log(getContinent('Kazakhstan'));    // 'Asia'
// console.log(getContinent(null));            // null
// console.log(listContinents());             // ['Asia', 'Europe', 'North America', ...]
// console.log(listCountries('Oceania'));      // ['Australia', 'Fiji', ...]
