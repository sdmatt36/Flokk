import type { Metadata } from "next";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Tours · Flokk",
  description: "Stop-by-stop tours built by Flokkers and Flokk's AI.",
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
          Tours
        </p>
        <p className="text-sm md:text-base italic" style={{ color: "rgba(250, 247, 242, 0.8)" }}>
          Stop-by-stop tours built by Flokkers and Flokk&apos;s AI.
        </p>
      </div>

      <section className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h2 className={`${playfair.className} text-3xl text-[#1B3A5C]`}>
          Coming soon.
        </h2>
        <p className="text-sm md:text-base italic text-[#1B3A5C]/70 mt-3">
          The full tours index is on its way. For now, head to{" "}
          <Link href="/tour" className="underline underline-offset-2">
            Tour Builder
          </Link>{" "}
          to create your own, or browse{" "}
          <Link href="/discover" className="underline underline-offset-2">
            Discover
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
