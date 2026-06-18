import type { Metadata } from "next";
import { Inter, DM_Sans } from "next/font/google";
import { ClerkProvider, Show, UserButton, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["700"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "Flokk",
  description: "Save it, plan it, book it, share it. Flokk rescues your saved Instagram posts, TikTok reels, and Google Maps stars and makes them actionable when it's time to plan your next family trip.",
  manifest: "/manifest.json",
  openGraph: {
    title: "Flokk | Family travel, planned.",
    description: "Save it, plan it, book it, share it. Save anywhere. Use here.",
    url: "https://flokktravel.com",
    siteName: "Flokk",
    type: "website",
    images: [
      {
        url: "https://www.flokktravel.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "flokk.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Flokk | Family travel, planned.",
    description: "Save it, plan it, book it, share it. Save anywhere. Use here.",
    images: ["https://www.flokktravel.com/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${dmSans.variable} antialiased`}>
        <ClerkProvider>
          {children}
          <Toaster />
          <Analytics />
        </ClerkProvider>
      </body>
    </html>
  );
}
