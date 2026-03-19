import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider, Show, UserButton, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Flokk",
  description: "Save it, plan it, book it, share it. Flokk rescues your saved Instagram posts, TikTok reels, and Google Maps stars and makes them actionable when it's time to plan your next family trip.",
  manifest: "/manifest.json",
  openGraph: {
    title: "Flokk — Family travel, planned.",
    description: "Save it, plan it, book it, share it. Save anywhere. Use here.",
    url: "https://flokktravel.com",
    siteName: "Flokk",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Flokk — Family travel, planned.",
    description: "Save it, plan it, book it, share it. Save anywhere. Use here.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <ClerkProvider>
          {children}
          <Toaster />
        </ClerkProvider>
      </body>
    </html>
  );
}
