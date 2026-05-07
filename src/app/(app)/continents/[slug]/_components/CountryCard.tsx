"use client";

import { useState } from "react";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

type Props = {
  country: { slug: string; name: string; _count: { cities: number } };
  continentColor: string;
};

export function CountryCard({ country, continentColor }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/countries/${country.slug}`}
      className="block rounded-2xl overflow-hidden min-h-[160px] hover:scale-[1.02] transition-transform duration-300"
      style={{
        backgroundColor: "#FBF6EC",
        border: `1px solid ${hovered ? continentColor : "#E8DDC8"}`,
        textDecoration: "none",
        transition: "border-color 0.3s ease, transform 0.3s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Accent strip */}
      <div className="h-1 w-full" style={{ backgroundColor: continentColor }} />

      <div className="p-6 flex flex-col justify-between" style={{ minHeight: "148px" }}>
        <span className={`${playfair.className} text-2xl md:text-3xl text-[#1B3A5C] leading-tight`}>
          {country.name}
        </span>
        {country._count.cities > 0 && (
          <span className="text-sm italic text-slate-600 mt-auto pt-3 block">
            {country._count.cities} {country._count.cities === 1 ? "city" : "cities"}
          </span>
        )}
      </div>
    </Link>
  );
}
