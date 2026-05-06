import Link from "next/link";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"] });

interface CityHeroProps {
  cityName: string;
  countryName: string;
  countrySlug: string;
  continentName: string;
  continentSlug: string;
  latitude: number | null;
  longitude: number | null;
  tags: string[];
  photoUrl?: string | null;
}

export function CityHero({
  cityName,
  countryName,
  countrySlug,
  continentName,
  continentSlug,
  latitude,
  longitude,
  tags,
  photoUrl,
}: CityHeroProps) {
  return (
    <>
      <style>{`
        .city-hero { min-height: 280px; }
        @media (max-width: 640px) { .city-hero { min-height: 200px; } }
      `}</style>
      <div
        className="city-hero"
        style={{
          position: "relative",
          backgroundColor: "#1B3A5C",
          ...(photoUrl
            ? { backgroundImage: `url('${photoUrl}')`, backgroundSize: "cover", backgroundPosition: "center" }
            : {}),
          paddingTop: "48px",
          paddingBottom: "48px",
        }}
      >
        {photoUrl && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(27,58,92,0.72) 0%, rgba(27,58,92,0.88) 100%)",
          }} />
        )}

        <div style={{ position: "relative", zIndex: 1, maxWidth: "1080px", margin: "0 auto", padding: "0 24px" }}>
          {/* Breadcrumb */}
          <nav style={{ marginBottom: "20px" }}>
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)" }}>
              <Link href={`/continents/${continentSlug}`} style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>
                {continentName}
              </Link>
              {" › "}
              <Link href={`/countries/${countrySlug}`} style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>
                {countryName}
              </Link>
              {" › "}
              <span style={{ color: "rgba(255,255,255,0.85)" }}>{cityName}</span>
            </span>
          </nav>

          {/* City name */}
          <h1
            className={playfair.className}
            style={{ fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 900, color: "#FFFFFF", lineHeight: 1.05, margin: 0 }}
          >
            {cityName}
          </h1>

          {/* Terracotta divider */}
          <div style={{ width: "48px", height: "3px", backgroundColor: "#C4664A", margin: "16px 0" }} />

          {/* Chips row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
            <span style={{
              fontSize: "13px", color: "rgba(255,255,255,0.8)",
              backgroundColor: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "20px", padding: "4px 12px",
            }}>
              {countryName}
            </span>

            {latitude !== null && longitude !== null && (
              <span style={{
                fontSize: "12px", color: "rgba(255,255,255,0.6)",
                backgroundColor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "20px", padding: "4px 12px", fontVariantNumeric: "tabular-nums",
              }}>
                {latitude.toFixed(2)}°, {longitude.toFixed(2)}°
              </span>
            )}

            {tags.slice(0, 4).map((tag) => (
              <span key={tag} style={{
                fontSize: "12px", color: "rgba(255,255,255,0.6)",
                backgroundColor: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: "20px", padding: "4px 10px",
                textTransform: "capitalize",
              }}>
                {tag.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
