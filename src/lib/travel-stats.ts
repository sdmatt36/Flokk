export const TOTAL_COUNTRIES = 195;

export const CITIES_PER_COUNTRY: Record<string, number> = {
  "Japan": 47, "USA": 50, "United States": 50,
  "France": 20, "Italy": 20, "Spain": 20,
  "Thailand": 15, "Indonesia": 17, "Australia": 8,
  "Germany": 16, "UK": 10, "United Kingdom": 10,
  "China": 34, "India": 28, "Brazil": 26,
  "Mexico": 32, "Canada": 13, "South Korea": 8,
  "Korea": 8, "Vietnam": 10, "Cambodia": 5,
  "Sri Lanka": 9, "Portugal": 8, "Greece": 13,
  "Turkey": 12, "Morocco": 12, "South Africa": 9,
  "Singapore": 1, "Maldives": 3, "Hong Kong": 1,
  "Taiwan": 6, "Nepal": 5, "Iceland": 4,
};

export interface TravelStats {
  totalTrips: number;
  totalCountries: number;
  totalCities: number;
  totalDays: number;
  percentOfWorld: number;
  countriesVisited: {
    country: string;
    cities: string[];
    cityCount: number;
    totalCities: number;
    percent: number;
  }[];
  topDestinations: {
    city: string;
    country: string;
    visits: number;
  }[];
}

export function calculateTravelStats(
  trips: { destinationCity: string | null; destinationCountry: string | null; status?: string; startDate?: string | null; endDate?: string | null }[]
): TravelStats {
  const completedTrips = trips.filter(
    (t) => !t.status || t.status === "COMPLETED" || t.status === "completed"
  );

  const countriesMap = new Map<string, Set<string>>();
  for (const trip of completedTrips) {
    const country = trip.destinationCountry ?? "Unknown";
    const city = trip.destinationCity ?? "";
    if (!countriesMap.has(country)) countriesMap.set(country, new Set());
    if (city) countriesMap.get(country)!.add(city);
  }

  const totalCountries = countriesMap.size;
  const allCities = new Set(completedTrips.map((t) => t.destinationCity).filter(Boolean));
  const totalCities = allCities.size;
  const percentOfWorld = Math.round((totalCountries / TOTAL_COUNTRIES) * 100 * 10) / 10;

  const countriesVisited = Array.from(countriesMap.entries())
    .map(([country, cities]) => ({
      country,
      cities: Array.from(cities),
      cityCount: cities.size,
      totalCities: CITIES_PER_COUNTRY[country] ?? 10,
      percent: Math.round((cities.size / (CITIES_PER_COUNTRY[country] ?? 10)) * 100),
    }))
    .sort((a, b) => b.cityCount - a.cityCount);

  const cityVisits = new Map<string, { city: string; country: string; visits: number }>();
  for (const trip of completedTrips) {
    if (!trip.destinationCity) continue;
    const key = trip.destinationCity;
    if (!cityVisits.has(key)) {
      cityVisits.set(key, { city: trip.destinationCity, country: trip.destinationCountry ?? "", visits: 0 });
    }
    cityVisits.get(key)!.visits++;
  }
  const topDestinations = Array.from(cityVisits.values())
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 5);

  const totalDays = completedTrips.reduce((sum, t) => {
    if (!t.startDate || !t.endDate) return sum;
    const days = Math.round((new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) / (1000 * 60 * 60 * 24));
    return sum + Math.max(0, days);
  }, 0);

  return { totalTrips: completedTrips.length, totalCountries, totalCities, totalDays, percentOfWorld, countriesVisited, topDestinations };
}
