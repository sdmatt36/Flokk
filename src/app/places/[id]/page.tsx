import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { categoryLabel } from "@/lib/categories";
import { Playfair_Display, DM_Sans } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"] });
const dmsans = DM_Sans({ subsets: ["latin"] });

export default async function SpotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const spot = await db.communitySpot.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      city: true,
      country: true,
      category: true,
      photoUrl: true,
      websiteUrl: true,
      description: true,
      averageRating: true,
      ratingCount: true,
      contributions: {
        select: {
          rating: true,
          note: true,
          family: { select: { familyName: true } },
        },
        where: { note: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!spot) notFound();

  const avg = spot.averageRating ?? 0;
  const rounded = Math.round(avg);
  const stars = "★".repeat(rounded) + "☆".repeat(5 - rounded);

  return (
    <div className={dmsans.className} style={{ minHeight: "100vh", background: "#FAFAF7" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid #E5E7EB", padding: "16px 24px", background: "white" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <h2 className={playfair.className} style={{ margin: 0, fontSize: 22, color: "#1B3A5C" }}>
            Flokk
          </h2>
        </Link>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 80px" }}>
        {/* Hero image */}
        {spot.photoUrl && (
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              borderRadius: 16,
              overflow: "hidden",
              marginBottom: 24,
              background: "#E5E7EB",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={spot.photoUrl}
              alt={spot.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        )}

        {/* Name + location */}
        <h1
          className={playfair.className}
          style={{ fontSize: 32, color: "#1B3A5C", margin: "0 0 8px", lineHeight: 1.2 }}
        >
          {spot.name}
        </h1>
        <p style={{ fontSize: 15, color: "#64748B", margin: "0 0 16px" }}>
          {[spot.city, spot.country].filter(Boolean).join(", ")}
        </p>

        {/* Rating + category */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          {avg > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#C4664A", fontSize: 18 }}>{stars}</span>
              <span style={{ fontSize: 13, color: "#64748B" }}>
                {avg.toFixed(1)} · {spot.ratingCount}{" "}
                {spot.ratingCount === 1 ? "family" : "families"}
              </span>
            </div>
          )}
          {spot.category && (
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                background: "#F1F5F9",
                color: "#1B3A5C",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {categoryLabel(spot.category)}
            </span>
          )}
        </div>

        {/* Description */}
        {spot.description && (
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "#334155", marginBottom: 24 }}>
            {spot.description}
          </p>
        )}

        {/* External link */}
        {spot.websiteUrl && (
          <a
            href={spot.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              marginBottom: 32,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #C4664A",
              color: "#C4664A",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Visit website →
          </a>
        )}

        {/* Family notes */}
        {spot.contributions.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h3
              className={playfair.className}
              style={{ fontSize: 20, color: "#1B3A5C", margin: "0 0 16px" }}
            >
              What families said
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {spot.contributions.map((c, i) => (
                <div
                  key={i}
                  style={{
                    padding: 16,
                    background: "white",
                    borderRadius: 12,
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1B3A5C" }}>
                      The {c.family?.familyName ?? "Flokk"} family
                    </span>
                    {c.rating !== null && (
                      <span style={{ color: "#C4664A", fontSize: 13 }}>
                        {"★".repeat(c.rating) + "☆".repeat(5 - c.rating)}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.5 }}>
                    {c.note}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Signup CTA */}
        <section
          style={{
            padding: 24,
            background: "white",
            borderRadius: 16,
            border: "1px solid #E5E7EB",
            textAlign: "center",
          }}
        >
          <h3
            className={playfair.className}
            style={{ fontSize: 22, color: "#1B3A5C", margin: "0 0 8px" }}
          >
            Save this to your own trips
          </h3>
          <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 16px" }}>
            Flokk helps families plan travel together. Keep track of places you love, share them
            with friends, and discover spots from other families.
          </p>
          <Link
            href="/sign-up"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              borderRadius: 999,
              background: "#C4664A",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Join Flokk
          </Link>
        </section>
      </main>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const spot = await db.communitySpot.findUnique({
    where: { id },
    select: {
      name: true,
      city: true,
      country: true,
      photoUrl: true,
      description: true,
    },
  });
  if (!spot) return { title: "Not found — Flokk" };
  return {
    title: `${spot.name} — ${spot.city} | Flokk`,
    description:
      spot.description ?? `Family-tested spot in ${spot.city}, discovered on Flokk.`,
    openGraph: {
      title: spot.name,
      description: spot.description ?? undefined,
      images: spot.photoUrl ? [{ url: spot.photoUrl }] : [],
    },
  };
}
