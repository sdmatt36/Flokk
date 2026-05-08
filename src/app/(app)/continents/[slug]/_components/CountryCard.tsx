"use client";

import Link from "next/link";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { getTripCoverImage, DEFAULT_COVER } from "@/lib/destination-images";

const dmsans = DM_Sans({ subsets: ["latin"], display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

type Props = {
  country: {
    slug: string;
    name: string;
    _count: { cities: number };
    spotCount: number;
    topCities: Array<{ name: string; photoUrl: string | null }>;
  };
  continentColor: string;
  continentLabel: string;
};

export function CountryCard({ country, continentColor, continentLabel }: Props) {
  const cityPhoto = country.topCities[0]?.photoUrl ?? null;
  const coverImage = cityPhoto ?? getTripCoverImage(null, country.name, null);
  const isColorFallback = coverImage === DEFAULT_COVER;

  const statsparts: string[] = [];
  if (country._count.cities > 0)
    statsparts.push(`${country._count.cities} ${country._count.cities === 1 ? "city" : "cities"}`);
  if (country.spotCount > 0)
    statsparts.push(`${country.spotCount} spots`);

  return (
    <div
      className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      style={{ backgroundColor: "#FBF6EC", borderRadius: "16px", overflow: "hidden", border: "1px solid #E8DDC8", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
    >
      <Link href={`/countries/${country.slug}`} style={{ textDecoration: "none", display: "block" }}>
        {/* Hero — image or continent color fallback */}
        {isColorFallback ? (
          <div style={{ height: "160px", backgroundColor: continentColor, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className={`${playfair.className} text-xl`} style={{ color: "rgba(255,255,255,0.9)" }}>
              {country.name}
            </span>
            <div style={{ position: "absolute", top: "10px", left: "10px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "rgba(255,255,255,0.25)", color: "#fff", borderRadius: "20px", padding: "3px 10px" }}>
                {continentLabel}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ height: "160px", backgroundImage: `url(${coverImage})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
            <div style={{ position: "absolute", top: "10px", left: "10px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: continentColor, color: "#fff", borderRadius: "20px", padding: "3px 10px" }}>
                {continentLabel}
              </span>
            </div>
          </div>
        )}

        {/* Meta */}
        <div style={{ padding: "14px 16px 10px" }}>
          <p style={{ fontSize: "15px", fontWeight: 700, color: "#1B3A5C", lineHeight: 1.3, marginBottom: statsparts.length > 0 ? "4px" : 0 }}>
            {country.name}
          </p>
          {statsparts.length > 0 && (
            <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.5 }}>
              {statsparts.join(" · ")}
            </p>
          )}
        </div>

        {/* Top-city chips */}
        {country.topCities.length > 0 && (
          <div style={{ padding: "0 16px 14px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {country.topCities.map((city) => (
              <span
                key={city.name}
                className={dmsans.className}
                style={{ fontSize: "11px", color: "#64748B", backgroundColor: "#fff", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "3px 10px" }}
              >
                {city.name}
              </span>
            ))}
          </div>
        )}
      </Link>
    </div>
  );
}
