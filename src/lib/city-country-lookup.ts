const CITY_TO_COUNTRY: Record<string, string> = {
  "tokyo": "Japan", "kyoto": "Japan", "osaka": "Japan", "hiroshima": "Japan",
  "nara": "Japan", "sapporo": "Japan", "fukuoka": "Japan", "okinawa": "Japan",
  "seoul": "South Korea", "busan": "South Korea", "jeju": "South Korea",
  "bangkok": "Thailand", "chiang mai": "Thailand", "phuket": "Thailand",
  "krabi": "Thailand", "koh samui": "Thailand", "koh lanta": "Thailand",
  "hanoi": "Vietnam", "ho chi minh city": "Vietnam", "saigon": "Vietnam",
  "hoi an": "Vietnam", "da nang": "Vietnam", "ninh binh": "Vietnam",
  "bali": "Indonesia", "ubud": "Indonesia", "jakarta": "Indonesia",
  "london": "United Kingdom", "edinburgh": "United Kingdom",
  "inverness": "United Kingdom", "glasgow": "United Kingdom",
  "manchester": "United Kingdom", "liverpool": "United Kingdom",
  "dublin": "Ireland", "galway": "Ireland", "cork": "Ireland",
  "belfast": "United Kingdom",
  "paris": "France", "nice": "France", "lyon": "France", "marseille": "France",
  "rome": "Italy", "florence": "Italy", "venice": "Italy", "milan": "Italy",
  "naples": "Italy", "amalfi": "Italy", "positano": "Italy", "sorrento": "Italy",
  "barcelona": "Spain", "madrid": "Spain", "seville": "Spain", "valencia": "Spain",
  "granada": "Spain", "san sebastian": "Spain",
  "lisbon": "Portugal", "porto": "Portugal",
  "athens": "Greece", "santorini": "Greece", "mykonos": "Greece", "crete": "Greece",
  "amsterdam": "Netherlands", "rotterdam": "Netherlands",
  "berlin": "Germany", "munich": "Germany", "hamburg": "Germany",
  "marrakech": "Morocco", "marrakesh": "Morocco", "casablanca": "Morocco",
  "fez": "Morocco", "fes": "Morocco", "tangier": "Morocco", "essaouira": "Morocco",
  "merzouga": "Morocco", "chefchaouen": "Morocco",
  "new york": "United States", "san francisco": "United States",
  "los angeles": "United States", "chicago": "United States", "miami": "United States",
  "detroit": "United States", "boston": "United States", "seattle": "United States",
  "new orleans": "United States",
  "toronto": "Canada", "vancouver": "Canada", "montreal": "Canada",
  "mexico city": "Mexico", "cancun": "Mexico", "tulum": "Mexico", "oaxaca": "Mexico",
  "puerto vallarta": "Mexico", "playa del carmen": "Mexico",
  "sydney": "Australia", "melbourne": "Australia", "brisbane": "Australia",
  "auckland": "New Zealand", "queenstown": "New Zealand", "wellington": "New Zealand",
  "delhi": "India", "mumbai": "India", "bangalore": "India",
  "jaipur": "India", "agra": "India", "udaipur": "India",
  "reykjavik": "Iceland", "copenhagen": "Denmark", "oslo": "Norway",
  "stockholm": "Sweden", "helsinki": "Finland",
  "dubai": "United Arab Emirates", "abu dhabi": "United Arab Emirates",
  "singapore": "Singapore",
  "buenos aires": "Argentina", "rio de janeiro": "Brazil",
  "lima": "Peru", "cusco": "Peru",
};

export function lookupCountryByCity(city: string | null | undefined): string | null {
  if (!city) return null;
  const normalized = city.trim().toLowerCase();
  if (!normalized) return null;
  return CITY_TO_COUNTRY[normalized] ?? null;
}

export function inferCountryFromCities(cities: Array<string | null | undefined>): string | null {
  for (const c of cities) {
    const hit = lookupCountryByCity(c);
    if (hit) return hit;
  }
  return null;
}
