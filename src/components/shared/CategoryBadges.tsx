import { categoryLabel } from "@/lib/categories";

interface CategoryBadgesProps {
  slugs: string[];
  variant?: "compact" | "full";
}

const BADGE: React.CSSProperties = {
  display: "inline-block",
  fontSize: "11px",
  fontWeight: 600,
  backgroundColor: "#FFF3EE",
  color: "#C4664A",
  border: "1px solid rgba(196,102,74,0.25)",
  borderRadius: "999px",
  padding: "2px 10px",
  whiteSpace: "nowrap",
};

const OVERFLOW: React.CSSProperties = {
  ...BADGE,
  backgroundColor: "#F5F5F5",
  color: "#999",
  border: "1px solid #E0E0E0",
};

export function CategoryBadges({ slugs, variant = "full" }: CategoryBadgesProps) {
  if (!slugs.length) return null;

  if (variant === "compact") {
    const overflow = slugs.length - 1;
    return (
      <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "nowrap" }}>
        <span style={BADGE}>{categoryLabel(slugs[0]) || slugs[0]}</span>
        {overflow > 0 && <span style={OVERFLOW}>+{overflow}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
      {slugs.map((slug) => (
        <span key={slug} style={BADGE}>
          {categoryLabel(slug) || slug}
        </span>
      ))}
    </div>
  );
}
