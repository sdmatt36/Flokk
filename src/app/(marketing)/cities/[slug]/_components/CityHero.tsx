import Link from "next/link";
import { DM_Sans, Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400"],
});

interface CityHeroProps {
  cityName: string;
  countryName: string;
  countrySlug: string;
  continentName: string;
  continentSlug: string;
  latitude: number | null;
  longitude: number | null;
  photoUrl?: string | null;
  blurb?: string | null;
  spotCount: number;
  tripCount: number;
  tourCount: number;
  ratingCount: number;
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function CityHero({
  cityName,
  countryName,
  countrySlug,
  continentName,
  continentSlug,
  latitude: _latitude,
  longitude: _longitude,
  photoUrl,
  blurb,
  spotCount,
  tripCount,
  tourCount,
  ratingCount,
}: CityHeroProps) {
  const isUnsplash = !!photoUrl && /unsplash\.com/i.test(photoUrl);

  const statsParts = [
    spotCount > 0 ? pluralize(spotCount, "spot", "spots") : null,
    tripCount > 0 ? pluralize(tripCount, "itinerary", "itineraries") : null,
    tourCount > 0 ? pluralize(tourCount, "tour", "tours") : null,
    ratingCount > 0 ? pluralize(ratingCount, "rating", "ratings") : null,
  ].filter((x): x is string => x !== null);

  const statsLine = statsParts.join(" · ");

  return (
    <section
      className="city-hero"
      style={{ position: "relative", overflow: "hidden" }}
    >
      <style>{`
        .city-hero { height: 480px; }
        .city-hero-name { font-size: 64px; }
        .city-hero-blurb { font-size: 18px; }
        .city-hero-breadcrumb { font-size: 14px; }
        .city-hero-stats { font-size: 14px; }
        .city-hero-breadcrumb a:hover { text-decoration: underline; }
        @media (max-width: 767px) {
          .city-hero { height: 360px; }
          .city-hero-name { font-size: 40px; }
          .city-hero-blurb { font-size: 16px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
          .city-hero-breadcrumb { font-size: 12px; }
          .city-hero-stats { font-size: 12px; }
        }
      `}</style>

      {/* Background: photo or solid navy fallback */}
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      ) : (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "#1B3A5C" }} />
      )}

      {/* Gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(27,58,92,0.6) 0%, rgba(27,58,92,0.2) 60%, transparent 100%)",
        }}
      />

      {/* Breadcrumb — top-left */}
      <nav
        className={`city-hero-breadcrumb ${dmSans.className}`}
        aria-label="Breadcrumb"
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          zIndex: 2,
          color: "rgba(255,255,255,0.85)",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "2px",
          lineHeight: 1.4,
        }}
      >
        <Link href="/continents" style={{ color: "inherit", textDecoration: "none" }}>
          Continents
        </Link>
        <span style={{ opacity: 0.6, padding: "0 3px" }}>›</span>
        <Link href={`/continents/${continentSlug}`} style={{ color: "inherit", textDecoration: "none" }}>
          {continentName}
        </Link>
        <span style={{ opacity: 0.6, padding: "0 3px" }}>›</span>
        <Link href={`/countries/${countrySlug}`} style={{ color: "inherit", textDecoration: "none" }}>
          {countryName}
        </Link>
        <span style={{ opacity: 0.6, padding: "0 3px" }}>›</span>
        <span style={{ opacity: 0.75 }}>{cityName}</span>
      </nav>

      {/* Bottom-left content: city name + blurb + stats */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 24,
          zIndex: 2,
          maxWidth: 600,
        }}
      >
        <h1
          className={`city-hero-name ${playfair.className}`}
          style={{
            fontWeight: 700,
            color: "#FFFFFF",
            lineHeight: 1.1,
            margin: "0 0 8px",
            textShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          {cityName}
        </h1>

        {blurb && (
          <p
            className={`city-hero-blurb ${playfair.className}`}
            style={{
              fontStyle: "italic",
              fontWeight: 400,
              color: "#FFFFFF",
              margin: "0 0 10px",
              lineHeight: 1.5,
              textShadow: "0 1px 3px rgba(0,0,0,0.5)",
            }}
          >
            {blurb}
          </p>
        )}

        {statsLine && (
          <p
            className={`city-hero-stats ${dmSans.className}`}
            style={{
              color: "rgba(255,255,255,0.8)",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {statsLine}
          </p>
        )}
      </div>

      {/* Photo credit — bottom-right, Unsplash only */}
      {isUnsplash && (
        <p
          className={dmSans.className}
          style={{
            position: "absolute",
            bottom: 24,
            right: 24,
            zIndex: 2,
            fontSize: 11,
            color: "rgba(255,255,255,0.6)",
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          Photo: Unsplash
        </p>
      )}
    </section>
  );
}
