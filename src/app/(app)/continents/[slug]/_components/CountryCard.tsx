"use client";

import { useState } from "react";
import Link from "next/link";
import { Playfair_Display, DM_Sans } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });
const dmsans = DM_Sans({ subsets: ["latin"], display: "swap" });

type Props = {
  country: {
    slug: string;
    name: string;
    _count: { cities: number };
    spotCount: number;
    topCities: Array<{ name: string }>;
  };
  continentColor: string;
};

export function CountryCard({ country, continentColor }: Props) {
  const [hovered, setHovered] = useState(false);

  const statsparts: string[] = [];
  if (country._count.cities > 0)
    statsparts.push(`${country._count.cities} ${country._count.cities === 1 ? "city" : "cities"}`);
  if (country.spotCount > 0)
    statsparts.push(`${country.spotCount} spots`);

  return (
    <Link
      href={`/countries/${country.slug}`}
      className="flex flex-col rounded-2xl overflow-hidden relative"
      style={{
        backgroundColor: "#FBF6EC",
        aspectRatio: "4/3",
        border: `1px solid ${hovered ? continentColor : "#E8DDC8"}`,
        textDecoration: "none",
        transition: "border-color 0.3s ease, transform 0.3s ease",
        transform: hovered ? "scale(1.02)" : "scale(1)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Accent strip */}
      <div className="flex-none h-1 w-full" style={{ backgroundColor: continentColor }} />

      {/* Silhouette watermark — right-aligned background decoration */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: continentColor,
          opacity: 0.18,
          WebkitMaskImage: `url(/svg/countries/${country.slug}.svg)`,
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskPosition: "right center",
          WebkitMaskSize: "contain",
          maskImage: `url(/svg/countries/${country.slug}.svg)`,
          maskRepeat: "no-repeat",
          maskPosition: "right center",
          maskSize: "contain",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex-1 p-6 flex flex-col justify-between">
        <div>
          <span className={`${playfair.className} text-2xl md:text-3xl text-[#1B3A5C] leading-tight`}>
            {country.name}
          </span>
          {statsparts.length > 0 && (
            <p className={`${dmsans.className} text-sm text-slate-600 mt-1`}>
              {statsparts.join(" · ")}
            </p>
          )}
        </div>

        {country.topCities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-auto pt-3">
            {country.topCities.map((city) => (
              <span
                key={city.name}
                className={`${dmsans.className} text-xs text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1`}
              >
                {city.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
