import type { Metadata } from "next";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Itineraries · Flokk",
  description: "Real day-by-day plans from real Flokkers.",
};

export default function ItinerariesPage() {
  return (
    <main>
      <div
        className="flex flex-col items-center justify-center h-24 md:h-36 gap-2 text-center px-4"
        style={{ backgroundColor: "#1B3A5C" }}
      >
        <p
          className={`${playfair.className} text-3xl md:text-5xl font-normal tracking-tight`}
          style={{ color: "#FAF7F2" }}
        >
          Itineraries
        </p>
        <p className="text-sm md:text-base italic" style={{ color: "rgba(250, 247, 242, 0.8)" }}>
          Real day-by-day plans from real Flokkers.
        </p>
      </div>

      <section className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h2 className={`${playfair.className} text-3xl text-[#1B3A5C]`}>
          Coming soon.
        </h2>
        <p className="text-sm md:text-base italic text-[#1B3A5C]/70 mt-3">
          We&apos;re building a full itinerary index. In the meantime, browse{" "}
          <Link href="/discover" className="underline underline-offset-2">
            Discover
          </Link>{" "}
          or{" "}
          <Link href="/trips" className="underline underline-offset-2">
            your trips
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
