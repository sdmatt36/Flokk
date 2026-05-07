import { Construction } from "lucide-react";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

export function UnderConstructionBanner() {
  return (
    <div
      className="w-full h-12 md:h-14 flex items-center justify-center px-4"
      style={{ backgroundColor: "#C4664A" }}
    >
      <div className="flex items-center gap-3 max-w-7xl mx-auto">
        <Construction className="size-5 shrink-0" style={{ color: "#FBF6EC" }} />
        <span className={`${playfair.className} text-base md:text-lg font-normal`} style={{ color: "#FBF6EC" }}>
          Excuse our Flokkin Mess.
        </span>
        <span className="text-sm md:text-base italic" style={{ color: "rgba(251,246,236,0.85)" }}>
          New Discover page coming soon.
        </span>
      </div>
    </div>
  );
}
