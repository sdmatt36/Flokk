import Link from "next/link";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"] });

interface CityHeroProps {
  cityName: string;
  countryName: string;
  countrySlug: string;
  continentName: string;
  continentSlug: string;
  latitude: number | null;   // kept for schema.org JSON-LD — not rendered
  longitude: number | null;  // kept for schema.org JSON-LD — not rendered
  tags: string[];
  photoUrl?: string | null;  // accepted but ignored — design is brand-only
}

export function CityHero({
  cityName,
  countryName,
  countrySlug,
  continentName,
  continentSlug,
  latitude: _latitude,
  longitude: _longitude,
  tags,
  photoUrl: _photoUrl,
}: CityHeroProps) {
  return (
    <section
      className="city-hero"
      style={{
        position: "relative",
        background: "linear-gradient(135deg, #1B3A5C 0%, #1B3A5C 40%, #C4664A 100%)",
        overflow: "hidden",
      }}
    >
      <style>{`
        .city-hero { min-height: 280px; padding: 56px 0 48px; }
        @media (max-width: 640px) { .city-hero { min-height: 200px; padding: 40px 0 32px; } }
      `}</style>

      {/* Topographic contour pattern + compass rose */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 400"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.08,
          pointerEvents: "none",
        }}
      >
        <g fill="none" stroke="#ffffff" strokeWidth="1.5">
          <path d="M0,80 Q300,50 600,90 T1200,70 T1440,85" />
          <path d="M0,140 Q280,110 580,160 T1180,130 T1440,150" />
          <path d="M0,200 Q320,170 640,220 T1240,200 T1440,210" />
          <path d="M0,260 Q300,230 620,280 T1200,260 T1440,270" />
          <path d="M0,320 Q280,290 600,340 T1180,320 T1440,330" />
          <path d="M0,380 Q320,350 640,400 T1240,380 T1440,390" />
        </g>
        <g fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.5" transform="translate(1280,80)">
          <circle cx="0" cy="0" r="40" />
          <circle cx="0" cy="0" r="30" />
          <line x1="0" y1="-40" x2="0" y2="40" />
          <line x1="-40" y1="0" x2="40" y2="0" />
          <line x1="-28" y1="-28" x2="28" y2="28" strokeOpacity="0.6" />
          <line x1="-28" y1="28" x2="28" y2="-28" strokeOpacity="0.6" />
        </g>
      </svg>

      {/* Foreground content */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: "1080px", margin: "0 auto", padding: "0 24px" }}>
        {/* Breadcrumb */}
        <nav style={{ marginBottom: "20px" }}>
          <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
            <Link href={`/continents/${continentSlug}`} style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>
              {continentName}
            </Link>
            {" › "}
            <Link href={`/countries/${countrySlug}`} style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>
              {countryName}
            </Link>
            {" › "}
            <span style={{ color: "rgba(255,255,255,0.9)" }}>{cityName}</span>
          </span>
        </nav>

        {/* City name — the visual hero of the page */}
        <h1
          className={playfair.className}
          style={{
            fontSize: "clamp(48px, 9vw, 120px)",
            fontWeight: 900,
            color: "#FFFFFF",
            lineHeight: 1.0,
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          {cityName}
        </h1>

        {/* Terracotta divider */}
        <div style={{
          width: "64px",
          height: "4px",
          backgroundColor: "#C4664A",
          margin: "20px 0",
          borderRadius: "2px",
        }} />

        {/* Chips row — country + tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <span style={{
            fontSize: "13px",
            color: "rgba(255,255,255,0.92)",
            backgroundColor: "rgba(255,255,255,0.16)",
            border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: "20px",
            padding: "5px 14px",
            fontWeight: 500,
          }}>
            {countryName}
          </span>

          {tags.slice(0, 4).map((tag) => (
            <span key={tag} style={{
              fontSize: "12px",
              color: "rgba(255,255,255,0.75)",
              backgroundColor: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: "20px",
              padding: "5px 12px",
              textTransform: "capitalize",
            }}>
              {tag.replace(/-/g, " ")}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
