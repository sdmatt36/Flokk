"use client";

import { CountryCard } from "./CountryCard";

type Country = {
  slug: string;
  name: string;
  _count: { cities: number };
  spotCount: number;
  topCities: Array<{ name: string; photoUrl: string | null }>;
};

type Props = {
  countries: Country[];
  continentColor: string;
  continentLabel: string;
  playfairClassName: string;
};

export function CountryGrid({ countries, continentColor, continentLabel, playfairClassName }: Props) {
  return (
    <div>
      <h2 className={`${playfairClassName} text-2xl md:text-3xl text-[#1B3A5C] mb-6`}>
        Browse {countries.length} countries
      </h2>

      {countries.length === 0 ? (
        <p className="text-center italic text-slate-600 py-12">
          No countries available.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {countries.map((country) => (
            <CountryCard
              key={country.slug}
              country={country}
              continentColor={continentColor}
              continentLabel={continentLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
