import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { ShareCardList } from "./ShareCardList";
import type { ApiItem } from "@/components/features/saves/SaveCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await db.cityShare.findUnique({ where: { token }, select: { citySlug: true } });
  if (!share) return { title: "Shared saves — Flokk" };
  const city = await db.city.findUnique({ where: { slug: share.citySlug }, select: { name: true } });
  return { title: `Saves in ${city?.name ?? share.citySlug} — Flokk` };
}

const IMPORT_SOURCE_METHODS = ["maps_import"];

export default async function CitySharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const share = await db.cityShare.findUnique({
    where: { token },
    select: { ownerProfileId: true, citySlug: true, scope: true },
  });
  if (!share) notFound();

  const city = await db.city.findUnique({
    where: { slug: share.citySlug },
    select: { id: true, name: true, heroPhotoUrl: true, photoUrl: true },
  });

  const cityFilter = city
    ? { OR: [{ cityId: city.id }, { AND: [{ cityId: null }, { destinationCity: city.name }] }] }
    : { destinationCity: share.citySlug };

  const sourceFilter =
    share.scope === "imports"
      ? { sourceMethod: { in: IMPORT_SOURCE_METHODS } }
      : {};

  const rawSaves = await db.savedItem.findMany({
    where: {
      familyProfileId: share.ownerProfileId,
      deletedAt: null,
      ...cityFilter,
      ...sourceFilter,
    },
    orderBy: { savedAt: "desc" },
    select: {
      id: true,
      rawTitle: true,
      placePhotoUrl: true,
      mediaThumbnailUrl: true,
      destinationCity: true,
      destinationCountry: true,
      categoryTags: true,
      sourceMethod: true,
      sourcePlatform: true,
      websiteUrl: true,
      sourceUrl: true,
      lat: true,
      lng: true,
      userRating: true,
      savedAt: true,
      tripId: true,
      dayIndex: true,
      needsPlaceConfirmation: true,
      communitySpotId: true,
      isBooked: true,
      trip: { select: { id: true, title: true } },
    },
  });

  // Serialize Dates to strings for the client component boundary
  const saves: ApiItem[] = rawSaves.map((s) => ({
    ...s,
    savedAt: s.savedAt.toISOString(),
    sourcePlatform: s.sourcePlatform ?? null,
    sourceUrl: s.sourceUrl ?? null,
    tripId: s.tripId ?? null,
    dayIndex: s.dayIndex ?? null,
    communitySpotId: s.communitySpotId ?? null,
    isBooked: s.isBooked ?? false,
    needsPlaceConfirmation: s.needsPlaceConfirmation ?? false,
    userRating: s.userRating ?? null,
    trip: s.trip ?? null,
  }));

  const cityName = city?.name ?? share.citySlug;
  const heroUrl = city?.heroPhotoUrl ?? city?.photoUrl ?? null;
  const scopeLabel = share.scope === "imports" ? "Google Maps imports" : "all saves";

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9" }}>
      {/* Hero */}
      {heroUrl && (
        <div style={{ width: "100%", height: 220, overflow: "hidden", position: "relative" }}>
          <img src={heroUrl} alt={cityName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55))" }} />
          <div style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700, color: "#fff", margin: 0, textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
              {cityName}
            </h1>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 100px" }}>
        {!heroUrl && (
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: "#1B3A5C", marginBottom: 8 }}>
            {cityName}
          </h1>
        )}

        <p style={{ fontSize: 14, color: "#717171", marginBottom: 28 }}>
          {saves.length} {saves.length === 1 ? "place" : "places"} shared ({scopeLabel})
        </p>

        {/* Save cards — rendered by client component */}
        <ShareCardList saves={saves} />

        {/* CTA */}
        <div
          style={{
            borderRadius: 16,
            padding: "24px 20px",
            background: "#1B3A5C",
            textAlign: "center",
          }}
        >
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
            Add all to my Flokk
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 18 }}>
            Save these places to your own Flokk and start planning.
          </p>
          <Link
            href={`/saves/from-share?cityToken=${token}`}
            style={{
              display: "inline-block",
              padding: "12px 28px",
              borderRadius: 24,
              background: "#C4664A",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Add all to my Flokk
          </Link>
        </div>
      </div>
    </div>
  );
}
