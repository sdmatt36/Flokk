import Link from "next/link";

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

interface CountrySpotCardProps {
  id: string;
  name: string;
  city: string | null;
  category: string | null;
  photoUrl: string | null;
  shareToken: string;
  averageRating: number | null;
  ratingCount: number;
  description: string | null;
}

export function CountrySpotCard({
  id,
  name,
  city,
  category,
  photoUrl,
  shareToken,
  averageRating,
  ratingCount,
  description,
}: CountrySpotCardProps) {
  const ratingInt = averageRating ? Math.round(averageRating) : null;
  const categoryLabel = category ? (CATEGORY_LABELS[category] ?? category) : null;

  return (
    <Link
      href={`/spots/${shareToken}`}
      style={{ textDecoration: "none", display: "flex", flexDirection: "column", flex: 1 }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "16px",
          overflow: "hidden",
          border: "1px solid #EEEEEE",
          boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <div
          style={{
            height: "160px",
            backgroundColor: "#1B3A5C1A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
          {ratingInt !== null && ratingInt >= 3 && (
            <span
              style={{
                position: "absolute",
                bottom: "10px",
                left: "10px",
                fontSize: "10px",
                fontWeight: 700,
                backgroundColor: "#C4664A",
                color: "#fff",
                borderRadius: "999px",
                padding: "3px 10px",
              }}
            >
              Flokk Approved
            </span>
          )}
        </div>

        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
          {city && (
            <p style={{ fontSize: "11px", color: "#AAAAAA", marginBottom: "3px" }}>{city}</p>
          )}
          <p
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#1B3A5C",
              marginBottom: "4px",
              lineHeight: 1.3,
            }}
          >
            {name}
          </p>
          {categoryLabel && (
            <p style={{ fontSize: "11px", color: "#C4664A", marginBottom: "4px" }}>{categoryLabel}</p>
          )}
          {description && (
            <p
              style={{
                fontSize: "12px",
                color: "#717171",
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {description}
            </p>
          )}
          {ratingInt !== null && ratingCount >= 2 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
              <span style={{ color: "#f59e0b", fontSize: "12px" }}>
                {"★".repeat(ratingInt)}{"☆".repeat(5 - ratingInt)}
              </span>
              <span style={{ fontSize: "11px", color: "#AAAAAA" }}>
                {ratingCount} families
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
