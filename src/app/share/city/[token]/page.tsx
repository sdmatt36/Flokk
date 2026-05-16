import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getItemImage } from "@/lib/destination-images";

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

  const saves = await db.savedItem.findMany({
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
      websiteUrl: true,
      mapsUrl: true,
    },
  });

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

        {/* Save cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 40 }}>
          {saves.map((save) => {
            const img = getItemImage(
              save.rawTitle,
              save.placePhotoUrl,
              save.mediaThumbnailUrl,
              save.categoryTags[0] ?? null,
              save.destinationCity,
              save.destinationCountry,
            );
            const title = save.rawTitle?.startsWith("http")
              ? `Place in ${save.destinationCity ?? "Unknown"}`
              : (save.rawTitle ?? "Saved place");
            const linkUrl = save.websiteUrl ?? save.mapsUrl ?? null;

            return (
              <div
                key={save.id}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #EEEEEE",
                  background: "#fff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "#F0EDE8" }}>
                  <img src={img} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, color: "#1B3A5C", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {title}
                  </p>
                  {save.categoryTags.length > 0 && (
                    <p style={{ fontSize: 11, color: "#717171", marginBottom: 4 }}>
                      {save.categoryTags[0].replace(/_/g, " ")}
                    </p>
                  )}
                  {linkUrl && (
                    <Link
                      href={linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "#C4664A", fontWeight: 600, textDecoration: "none" }}
                    >
                      Link
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

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
