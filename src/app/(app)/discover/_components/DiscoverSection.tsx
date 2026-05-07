import { Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

interface DiscoverSectionProps {
  title: string;
  description: string;
  addLabel: string;
  addHref: string;
  browseAllLabel: string;
  browseAllHref: string;
  children: React.ReactNode;
}

export function DiscoverSection({
  title,
  description,
  addLabel,
  addHref,
  browseAllLabel,
  browseAllHref,
  children,
}: DiscoverSectionProps) {
  return (
    <section className="max-w-7xl mx-auto px-6 py-12 md:py-16">
      {/* Header row: title left, + CTA right */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <h2 className={`${playfair.className} text-2xl md:text-3xl text-[#1B3A5C]`}>
          {title}
        </h2>
        <Link
          href={addHref}
          className="flex items-center gap-1.5 text-sm md:text-base text-[#C4664A] hover:text-[#1B3A5C] font-medium transition-colors whitespace-nowrap"
        >
          <Plus className="size-4" />
          {addLabel}
        </Link>
      </div>

      {/* Description */}
      <p className="italic text-sm md:text-base text-[#1B3A5C]/70 mb-8 max-w-3xl">
        {description}
      </p>

      {/* Content slot */}
      {children}

      {/* Browse all footer */}
      <div className="mt-8 text-right">
        <Link
          href={browseAllHref}
          className="inline-flex items-center gap-1 text-sm md:text-base text-[#C4664A] hover:text-[#1B3A5C] font-medium"
        >
          {browseAllLabel}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
