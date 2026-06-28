import type { ReactNode } from "react";
import { playfair, dmSans } from "@/lib/share-fonts";

// Public granular/tour share routes (/s/*). Same brand-font wrapper as /share: loads Playfair
// (--font-playfair) + DM Sans (--font-dm-sans) and defaults body text to DM Sans. Presentation
// only; the root layout and the logged-in (app) layout are untouched.
export default function ShareItemLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${playfair.variable} ${dmSans.variable}`}
      style={{ fontFamily: "var(--font-dm-sans), Inter, sans-serif" }}
    >
      {children}
    </div>
  );
}
