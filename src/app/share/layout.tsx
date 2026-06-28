import type { ReactNode } from "react";
import { playfair, dmSans } from "@/lib/share-fonts";

// Public share routes (/share/*). Loads the brand fonts (Playfair via --font-playfair, DM Sans
// via --font-dm-sans) and defaults body text to DM Sans. Headings that set
// fontFamily: "var(--font-playfair), ..." resolve to the loaded Playfair. Presentation only;
// the root layout and the logged-in (app) layout are untouched.
export default function ShareLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${playfair.variable} ${dmSans.variable}`}
      style={{ fontFamily: "var(--font-dm-sans), Inter, sans-serif" }}
    >
      {children}
    </div>
  );
}
