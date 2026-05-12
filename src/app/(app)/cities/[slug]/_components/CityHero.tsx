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

interface UnsplashAttribution {
  photographerName: string;
  photographerUrl: string;
  photoUrl: string;
  source: "unsplash";
}

interface CityHeroProps {
  cityName: string;
  latitude: number | null;
  longitude: number | null;
  photoUrl?: string | null;
  heroPhotoUrl?: string | null;
  heroPhotoAttribution?: string | null;
  blurb?: string | null;
  spotCount: number;
  tripCount: number;
  tourCount: number;
  ratingCount: number;
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function parseAttribution(raw: string | null | undefined): UnsplashAttribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.source === "unsplash" && parsed.photographerName && parsed.photographerUrl) {
      return parsed as UnsplashAttribution;
    }
    return null;
  } catch {
    return null;
  }
}

export function CityHero({
  cityName,
  latitude: _latitude,
  longitude: _longitude,
  photoUrl,
  heroPhotoUrl,
  heroPhotoAttribution,
  blurb,
  spotCount,
  tripCount,
  tourCount,
  ratingCount,
}: CityHeroProps) {
  // heroPhotoUrl takes priority over legacy photoUrl
  const renderPhotoUrl = heroPhotoUrl ?? photoUrl;

  // Attribution: structured if heroPhotoUrl is set, generic fallback for legacy Unsplash URLs
  const attribution = heroPhotoUrl
    ? parseAttribution(heroPhotoAttribution)
    : null;
  const isLegacyUnsplash = !heroPhotoUrl && !!photoUrl && /unsplash\.com/i.test(photoUrl);

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
        .city-hero-stats { font-size: 14px; }
        @media (max-width: 767px) {
          .city-hero { height: 360px; }
          .city-hero-name { font-size: 40px; }
          .city-hero-blurb { font-size: 16px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
          .city-hero-stats { font-size: 12px; }
        }
      `}</style>

      {/* Background: photo or solid navy fallback */}
      {renderPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={renderPhotoUrl}
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

      {/* Top scrim — darkens breadcrumb zone */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "40%",
          zIndex: 1,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 30%, transparent 60%)",
        }}
      />
      {/* Bottom scrim — darkens city name / blurb / stats zone */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "70%",
          zIndex: 1,
          background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.45) 25%, rgba(0,0,0,0.15) 50%, transparent 70%)",
        }}
      />
      {/* Localized text backdrop — elliptical darkening under bottom-left content only */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "min(720px, 100%)",
          height: "60%",
          zIndex: 1,
          pointerEvents: "none",
          background: "radial-gradient(ellipse 70% 55% at 22% 75%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0.1) 70%, transparent 85%)",
        }}
      />

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
            textShadow: "0 2px 16px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.6)",
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
              textShadow: "0 1px 6px rgba(0,0,0,0.75)",
            }}
          >
            {blurb}
          </p>
        )}

        {statsLine && (
          <p
            className={`city-hero-stats ${dmSans.className}`}
            style={{
              color: "rgba(255,255,255,0.92)",
              margin: 0,
              lineHeight: 1.4,
              textShadow: "0 1px 4px rgba(0,0,0,0.7)",
            }}
          >
            {statsLine}
          </p>
        )}
      </div>

      {/* Photo credit — bottom-right */}
      {attribution ? (
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
          Photo by{" "}
          <a
            href={attribution.photographerUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "inherit", textDecoration: "underline" }}
          >
            {attribution.photographerName}
          </a>
          {" "}on{" "}
          <a
            href="https://unsplash.com?utm_source=flokk&utm_medium=referral"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "inherit", textDecoration: "underline" }}
          >
            Unsplash
          </a>
        </p>
      ) : isLegacyUnsplash ? (
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
      ) : null}
    </section>
  );
}
