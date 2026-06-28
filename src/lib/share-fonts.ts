// Brand fonts for the PUBLIC share routes only (src/app/share, src/app/s). The root layout
// loads Inter (body) + DM Sans var, but NOT Playfair, and the share routes do not sit under the
// logged-in (app) layout — so cold-traffic share headings were falling back to generic serif.
// These next/font instances expose CSS variables consumed by the share layouts; nothing under
// the logged-in app references this module.
import { Playfair_Display, DM_Sans } from "next/font/google";

export const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-playfair",
  display: "swap",
});

export const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});
