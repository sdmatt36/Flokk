import Link from "next/link";

interface CountryCityCardProps {
  slug: string;
  name: string;
  photoUrl: string | null;
  spotCount: number;
  href?: string;
  countLabel?: string;
}

export function CountryCityCard({ slug, name, photoUrl, spotCount, href, countLabel }: CountryCityCardProps) {
  const destination = href ?? `/cities/${slug}`;
  const label = countLabel ?? `${spotCount} ${spotCount === 1 ? "spot" : "spots"}`;
  return (
    <Link href={destination} style={{ textDecoration: "none", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "16px",
          overflow: "hidden",
          border: "1px solid #EEEEEE",
          boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            height: "140px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "linear-gradient(135deg, #1B3A5C 0%, #C4664A 100%)",
              }}
            />
          )}
        </div>
        <div style={{ padding: "12px 16px 14px" }}>
          <p style={{ fontSize: "14px", fontWeight: 600, color: "#1B3A5C", marginBottom: "2px" }}>
            {name}
          </p>
          {spotCount > 0 && (
            <p style={{ fontSize: "11px", color: "#AAAAAA" }}>
              {label}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
