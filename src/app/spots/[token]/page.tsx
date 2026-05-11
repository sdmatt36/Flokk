import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Playfair_Display, DM_Sans } from "next/font/google";
import Link from "next/link";
import type { Metadata } from "next";
import { SpotDetailActions } from "./_components/SpotDetailActions";

export const dynamic = "force-dynamic";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });
const dmsans = DM_Sans({ subsets: ["latin"], display: "swap" });

const CATEGORY_LABELS: Record<string, string> = {
  food_and_drink: "Food & Drink",
  experiences: "Experiences",
  accommodation: "Accommodation",
  shopping: "Shopping",
  nature: "Nature",
  culture: "Culture",
  entertainment: "Entertainment",
  transport: "Transport",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const spot = await db.communitySpot.findUnique({
    where: { shareToken: token },
    select: { name: true, city: true, country: true },
  });
  if (!spot) return { title: "Spot not found — Flokk" };
  const loc = [spot.city, spot.country].filter(Boolean).join(", ");
  return {
    title: `${spot.name}${loc ? ` · ${loc}` : ""} — Flokk`,
  };
}

export default async function SpotDetailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const spot = await db.communitySpot.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      name: true,
      city: true,
      country: true,
      category: true,
      description: true,
      photoUrl: true,
      websiteUrl: true,
      address: true,
      lat: true,
      lng: true,
      averageRating: true,
      ratingCount: true,
      isPublic: true,
      shareToken: true,
      geoCity: {
        select: {
          slug: true,
          country: { select: { slug: true } },
        },
      },
    },
  });

  // Not found
  if (!spot) {
    return (
      <main
        className={dmsans.className}
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center", backgroundColor: "#FAF7F2" }}
      >
        <p style={{ fontSize: "48px", marginBottom: "16px" }}>404</p>
        <h1 className={playfair.className} style={{ fontSize: "28px", color: "#1B3A5C", marginBottom: "8px" }}>
          Spot not found
        </h1>
        <p style={{ fontSize: "15px", color: "#717171", marginBottom: "32px" }}>
          This spot may have been removed or the link is incorrect.
        </p>
        <Link
          href="/discover"
          style={{ backgroundColor: "#C4664A", color: "#fff", borderRadius: "12px", padding: "12px 28px", fontSize: "14px", fontWeight: 600, textDecoration: "none" }}
        >
          Explore destinations
        </Link>
      </main>
    );
  }

  // Private spot
  if (!spot.isPublic) {
    return (
      <main
        className={dmsans.className}
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center", backgroundColor: "#FAF7F2" }}
      >
        <h1 className={playfair.className} style={{ fontSize: "28px", color: "#1B3A5C", marginBottom: "8px" }}>
          This spot is private
        </h1>
        <p style={{ fontSize: "15px", color: "#717171", marginBottom: "32px" }}>
          The owner has not made this spot public.
        </p>
        <Link
          href="/discover"
          style={{ backgroundColor: "#C4664A", color: "#fff", borderRadius: "12px", padding: "12px 28px", fontSize: "14px", fontWeight: 600, textDecoration: "none" }}
        >
          View public spots
        </Link>
      </main>
    );
  }

  const { userId } = await auth();
  const isSignedIn = !!userId;

  const categoryLabel = spot.category ? (CATEGORY_LABELS[spot.category] ?? spot.category) : null;
  const citySlug = spot.geoCity?.slug ?? null;
  const countrySlug = spot.geoCity?.country?.slug ?? null;

  const mapsUrl =
    spot.lat && spot.lng
      ? `https://maps.google.com/?q=${spot.lat},${spot.lng}`
      : spot.address
      ? `https://maps.google.com/?q=${encodeURIComponent(spot.address)}`
      : null;

  const ratingInt = spot.averageRating ? Math.round(spot.averageRating) : null;

  return (
    <main className={dmsans.className} style={{ minHeight: "100vh", backgroundColor: "#FAF7F2" }}>

      {/* Hero */}
      <div
        style={{
          height: "280px",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#1B3A5C",
          backgroundImage: spot.photoUrl ? `url('${spot.photoUrl}')` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.70) 100%)" }} />
        {categoryLabel && (
          <div style={{ position: "absolute", top: "20px", left: "20px", zIndex: 2 }}>
            <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#C4664A", color: "#fff", borderRadius: "999px", padding: "4px 12px" }}>
              {categoryLabel}
            </span>
          </div>
        )}
        <div style={{ position: "absolute", bottom: "24px", left: "24px", right: "24px", zIndex: 2 }}>
          <h1 className={playfair.className} style={{ fontSize: "28px", fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: "8px", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
            {spot.name}
          </h1>
          {/* Breadcrumb */}
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
            {citySlug ? (
              <Link href={`/cities/${citySlug}`} style={{ color: "rgba(255,255,255,0.9)", textDecoration: "underline", textUnderlineOffset: "2px" }}>
                {spot.city}
              </Link>
            ) : spot.city}
            {spot.country && (
              <>
                {" · "}
                {countrySlug ? (
                  <Link href={`/countries/${countrySlug}`} style={{ color: "rgba(255,255,255,0.9)", textDecoration: "underline", textUnderlineOffset: "2px" }}>
                    {spot.country}
                  </Link>
                ) : spot.country}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "32px 24px" }}>

        {/* Description */}
        {spot.description && (
          <p style={{ fontSize: "15px", color: "#374151", lineHeight: 1.7, marginBottom: "24px" }}>
            {spot.description}
          </p>
        )}

        {/* Rating */}
        {ratingInt !== null && spot.ratingCount >= 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <span style={{ color: "#f59e0b", fontSize: "16px", letterSpacing: "2px" }}>
              {"★".repeat(ratingInt)}{"☆".repeat(5 - ratingInt)}
            </span>
            <span style={{ fontSize: "13px", color: "#717171" }}>
              {spot.ratingCount === 1 ? "1 family rated this" : `${spot.ratingCount} families rated this`}
            </span>
          </div>
        )}

        {/* Address */}
        {spot.address && (
          <div style={{ marginBottom: "20px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#AAAAAA", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Address</p>
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "14px", color: "#C4664A", textDecoration: "underline", textUnderlineOffset: "2px" }}>
                {spot.address}
              </a>
            ) : (
              <p style={{ fontSize: "14px", color: "#374151" }}>{spot.address}</p>
            )}
          </div>
        )}

        {/* Website */}
        {spot.websiteUrl && (
          <div style={{ marginBottom: "24px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#AAAAAA", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Website</p>
            <a href={spot.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "14px", color: "#C4664A", textDecoration: "underline", textUnderlineOffset: "2px" }}>
              {spot.websiteUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
            </a>
          </div>
        )}

        <div style={{ borderTop: "1px solid #E8DDC8", paddingTop: "24px" }}>
          <SpotDetailActions
            spotId={spot.id}
            spotName={spot.name}
            spotCity={spot.city}
            spotPhotoUrl={spot.photoUrl}
            spotCategory={spot.category}
            spotWebsiteUrl={spot.websiteUrl}
            shareToken={spot.shareToken!}
            isSignedIn={isSignedIn}
          />
        </div>
      </div>
    </main>
  );
}
