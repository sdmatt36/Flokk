import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import Link from "next/link";
import { ToursPageClient } from "./_components/ToursPageClient";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Your Tours · Flokk",
  description: "Tours you've built. Pick up where you left off.",
};

export default function ToursPage() {
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
          Your Tours
        </p>
        <p className="text-sm md:text-base italic" style={{ color: "rgba(250, 247, 242, 0.8)" }}>
          Tours you&apos;ve built. Pick up where you left off.
        </p>
      </div>

      <section className="bg-white border-b border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <h2
              className="text-xl md:text-2xl text-[#1B3A5C] font-medium"
              style={{ fontFamily: playfair.style.fontFamily }}
            >
              Build a tour for your family
            </h2>
            <p className="text-sm md:text-base text-[#555] mt-1.5 leading-relaxed">
              Tell us a destination and your kids&apos; ages. We&apos;ll generate a kid-paced walking tour in seconds.
            </p>
          </div>
          <Link
            href="/tour"
            className="shrink-0 inline-flex items-center justify-center px-6 py-3 bg-[#C4664A] text-white rounded-lg font-semibold text-sm hover:bg-[#A85539] transition-colors"
          >
            Build a Tour
          </Link>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-12">
        <ToursPageClient />
      </section>
    </main>
  );
}
