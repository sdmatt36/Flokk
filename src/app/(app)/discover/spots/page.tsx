import Link from "next/link";
import { Search } from "lucide-react";
import { Playfair_Display, DM_Sans } from "next/font/google";
import { getFeaturedCities, type FeaturedCity } from "@/lib/featured-cities";
import { listContinents } from "@/lib/continents";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"] });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500"] });

function CityHeroCard({ city, spotCount, contributorCount, heroPhotoUrl }: FeaturedCity) {
  return (
    <Link href={`/c/${encodeURIComponent(city.toLowerCase())}`} className="group block">
      <div
        className="relative rounded-xl overflow-hidden shadow-sm group-hover:shadow-lg group-hover:-translate-y-0.5 transition-all duration-150"
        style={{ aspectRatio: "4 / 3" }}
      >
        {heroPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroPhotoUrl}
            alt={`Hero photo of ${city}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1B3A5C] to-[#C4664A]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <h3 className={`${playfair.className} text-2xl mb-1`}>{city}</h3>
          <p
            className={`${dmSans.className} text-xs uppercase tracking-wider opacity-90`}
          >
            {spotCount} spot{spotCount === 1 ? "" : "s"} &middot;{" "}
            {contributorCount} famil{contributorCount === 1 ? "y" : "ies"}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default async function DiscoverSpotsPage() {
  const { cities, mode } = await getFeaturedCities();
  const continents = listContinents();

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "96px" }}>
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <nav className={`${dmSans.className} text-sm text-slate-500 mb-6`}>Spots</nav>

        {/* Search bar — visually present, wiring comes in full redesign */}
        <div className="max-w-2xl mx-auto mb-10">
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Where to?"
              className={`${dmSans.className} w-full pl-12 pr-4 py-3 rounded-full border border-slate-200 shadow-sm bg-white text-base text-slate-900 focus:outline-none focus:ring-2 focus:border-[#1B3A5C] cursor-not-allowed opacity-60`}
              disabled
              title="Search wiring comes in the full redesign"
            />
          </div>
        </div>

        {/* Section heading */}
        <h2 className={`${playfair.className} text-2xl md:text-3xl text-[#1B3A5C] mb-6`}>
          {mode === "trending" ? "Trending this week" : "Top cities"}
        </h2>

        {/* City hero grid */}
        {cities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {cities.map(city => (
              <CityHeroCard key={city.city} {...city} />
            ))}
          </div>
        ) : (
          <p className={`${dmSans.className} text-slate-500 text-sm mb-16`}>
            No featured cities yet. Start rating spots to build the community layer.
          </p>
        )}

        {/* Continent strip */}
        <div className="border-t border-slate-200 pt-8">
          <p className={`${dmSans.className} text-sm text-slate-500 mb-4`}>
            Or browse by continent
          </p>
          <div className="flex flex-wrap gap-2">
            {continents.map(continent => (
              <Link
                key={continent}
                href={`/continents/${continent.toLowerCase().replace(/\s+/g, "-")}`}
                className={`${dmSans.className} px-4 py-2 rounded-full border border-slate-200 hover:border-[#1B3A5C] text-sm text-slate-700 transition-colors`}
              >
                {continent}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
