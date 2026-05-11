import Link from "next/link";
import { db } from "@/lib/db";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

interface Props {
  variant: "continent" | "country" | "city";
  entityId: string;
}

export async function FlokkersAlsoLove({ variant, entityId }: Props) {
  if (variant === "continent") return <ContinentAlsoLove entityId={entityId} />;
  if (variant === "country") return <CountryAlsoLove entityId={entityId} />;
  return <CityAlsoLove entityId={entityId} />;
}

// ── Continent variant — 6 top featured cities in this continent ───────────────

async function ContinentAlsoLove({ entityId }: { entityId: string }) {
  const cities = await db.city.findMany({
    where: {
      featured: true,
      country: { continentId: entityId },
    },
    orderBy: { priorityRank: "asc" },
    take: 6,
    select: { slug: true, name: true, photoUrl: true, country: { select: { name: true } } },
  });

  if (cities.length === 0) return null;

  return (
    <AlsoLoveShell heading="Flokkers also love">
      {cities.map((city) => (
        <MiniCard
          key={city.slug}
          href={`/cities/${city.slug}`}
          name={city.name}
          subtitle={city.country.name}
          photoUrl={city.photoUrl}
        />
      ))}
    </AlsoLoveShell>
  );
}

// ── Country variant — 6 sibling countries in same continent ──────────────────

async function CountryAlsoLove({ entityId }: { entityId: string }) {
  const current = await db.country.findUnique({
    where: { id: entityId },
    select: { continentId: true },
  });
  if (!current) return null;

  const countries = await db.country.findMany({
    where: { continentId: current.continentId, id: { not: entityId } },
    orderBy: { name: "asc" },
    take: 6,
    select: { slug: true, name: true, photoUrl: true, continent: { select: { name: true } } },
  });

  if (countries.length === 0) return null;

  return (
    <AlsoLoveShell heading="Flokkers also love">
      {countries.map((country) => (
        <MiniCard
          key={country.slug}
          href={`/countries/${country.slug}`}
          name={country.name}
          subtitle={country.continent.name}
          photoUrl={country.photoUrl}
        />
      ))}
    </AlsoLoveShell>
  );
}

// ── City variant — 6 sibling featured cities in same country ─────────────────

async function CityAlsoLove({ entityId }: { entityId: string }) {
  const current = await db.city.findUnique({
    where: { id: entityId },
    select: { countryId: true, country: { select: { name: true } } },
  });
  if (!current) return null;

  const cities = await db.city.findMany({
    where: { countryId: current.countryId, id: { not: entityId }, featured: true },
    orderBy: { priorityRank: "asc" },
    take: 6,
    select: { slug: true, name: true, photoUrl: true },
  });

  if (cities.length === 0) return null;

  return (
    <AlsoLoveShell heading="Flokkers also love">
      {cities.map((city) => (
        <MiniCard
          key={city.slug}
          href={`/cities/${city.slug}`}
          name={city.name}
          subtitle={current.country.name}
          photoUrl={city.photoUrl}
        />
      ))}
    </AlsoLoveShell>
  );
}

// ── Shared shell ──────────────────────────────────────────────────────────────

function AlsoLoveShell({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: "48px 0 16px" }}>
      <h2
        className={playfair.className}
        style={{ fontSize: "22px", fontWeight: 700, color: "#1B3A5C", marginBottom: "20px" }}
      >
        {heading}
      </h2>
      {/* Desktop: 3-up grid. Mobile: horizontal scroll */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
        }}
        className="also-love-grid"
      >
        {children}
      </div>
      <style>{`
        @media (max-width: 640px) {
          .also-love-grid {
            display: flex !important;
            overflow-x: auto;
            gap: 12px !important;
            padding-bottom: 8px;
          }
          .also-love-grid > * {
            flex: 0 0 200px;
          }
        }
      `}</style>
    </section>
  );
}

// ── Mini card ─────────────────────────────────────────────────────────────────

function MiniCard({ href, name, subtitle, photoUrl }: {
  href: string;
  name: string;
  subtitle: string;
  photoUrl: string | null;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none", display: "block" }}>
      <div
        style={{
          borderRadius: "14px",
          overflow: "hidden",
          border: "1px solid #EEEEEE",
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
          backgroundColor: "#fff",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        className="also-love-card"
      >
        <div style={{ height: "130px", position: "relative", overflow: "hidden" }}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1B3A5C 0%, #C4664A 100%)" }} />
          )}
        </div>
        <div style={{ padding: "10px 14px 12px" }}>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#1B3A5C", lineHeight: 1.3 }}>{name}</p>
          <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94A3B8" }}>{subtitle}</p>
        </div>
      </div>
      <style>{`
        .also-love-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.10);
        }
      `}</style>
    </Link>
  );
}
