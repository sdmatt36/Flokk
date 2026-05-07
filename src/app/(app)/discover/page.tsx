import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { ContinentGrid } from "./_components/ContinentGrid";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Discover · Flokk",
  description: "Where will your flokk land? Pick a horizon to start.",
};

export default function DiscoverPage() {
  return (
    <main>
      {/* Tagline band */}
      <div
        className="flex flex-col items-center justify-center h-24 md:h-36 gap-2 text-center px-4"
        style={{ backgroundColor: "#1B3A5C" }}
      >
        <p
          className={`${playfair.className} text-3xl md:text-5xl font-normal tracking-tight`}
          style={{ color: "#FAF7F2" }}
        >
          Where will your flokk land?
        </p>
        <p
          className="text-sm md:text-base italic"
          style={{ color: "rgba(250, 247, 242, 0.8)" }}
        >
          Pick a horizon to start.
        </p>
      </div>

      {/* Continent grid */}
      <ContinentGrid playfairClassName={playfair.className} />
    </main>
  );
}
