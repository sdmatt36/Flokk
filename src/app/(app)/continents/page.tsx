import Link from "next/link";
import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import { db } from "@/lib/db";
import { CONTINENT_CONFIGS } from "@/lib/continents";

export const dynamic = "force-dynamic";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });
const dmsans = DM_Sans({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Explore by Continent | Flokk",
  description:
    "Browse the world by region. Click into any continent to see countries and the families who've been there.",
};

export default async function ContinentsIndexPage() {
  const rows = await db.continent.findMany({
    select: {
      slug: true,
      photoUrl: true,
      _count: { select: { countries: true } },
    },
  });

  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  const items = CONTINENT_CONFIGS.map((config) => {
    const row = bySlug.get(config.slug);
    return {
      slug: config.slug,
      label: config.label,
      tagline: config.tagline,
      color: config.color,
      photoUrl: row?.photoUrl ?? null,
      countryCount: row?._count.countries ?? 0,
    };
  });

  return (
    <main className={dmsans.className} style={{ minHeight: "100vh", backgroundColor: "#FAF7F2" }}>
      {/* Hero */}
      <div style={{ backgroundColor: "#1B3A5C", padding: "64px 24px 48px", textAlign: "center" }}>
        <h1
          className={playfair.className}
          style={{ fontSize: "42px", fontWeight: 700, color: "#FAF7F2", marginBottom: "12px", lineHeight: 1.2 }}
        >
          Explore by Continent
        </h1>
        <div style={{ width: "48px", height: "3px", backgroundColor: "#C4664A", margin: "0 auto 16px" }} />
        <p style={{ fontSize: "15px", color: "rgba(250,247,242,0.75)", maxWidth: "480px", margin: "0 auto", lineHeight: 1.6 }}>
          Browse the world by region. Click into any continent to see countries and the families who&apos;ve been there.
        </p>
      </div>

      {/* Continent grid */}
      <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "48px 24px 80px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {items.map((continent) => (
            <Link
              key={continent.slug}
              href={`/continents/${continent.slug}`}
              style={{ textDecoration: "none", display: "flex", flexDirection: "column" }}
            >
              <div
                style={{
                  backgroundColor: "#FBF6EC",
                  borderRadius: "16px",
                  overflow: "hidden",
                  border: "1px solid #E8DDC8",
                  boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
                  flex: 1,
                }}
              >
                {/* Hero — photo or color block (mirrors CountryCard pattern) */}
                {continent.photoUrl ? (
                  <div
                    style={{
                      height: "160px",
                      backgroundImage: `url(${continent.photoUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      position: "relative",
                    }}
                  >
                    <div style={{ position: "absolute", top: "10px", left: "10px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          backgroundColor: continent.color,
                          color: "#fff",
                          borderRadius: "20px",
                          padding: "3px 10px",
                        }}
                      >
                        {continent.label}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      height: "160px",
                      backgroundColor: continent.color,
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      className={playfair.className}
                      style={{ fontSize: "22px", color: "rgba(255,255,255,0.9)" }}
                    >
                      {continent.label}
                    </span>
                  </div>
                )}

                {/* Meta */}
                <div style={{ padding: "14px 16px 14px" }}>
                  <p
                    className={playfair.className}
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "#1B3A5C",
                      lineHeight: 1.3,
                      marginBottom: "4px",
                    }}
                  >
                    {continent.label}
                  </p>
                  {continent.countryCount > 0 && (
                    <p style={{ fontSize: "12px", color: "#717171", marginBottom: "4px" }}>
                      {continent.countryCount}{" "}
                      {continent.countryCount === 1 ? "country" : "countries"}
                    </p>
                  )}
                  <p style={{ fontSize: "12px", color: "#717171", fontStyle: "italic", lineHeight: 1.5 }}>
                    {continent.tagline}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
