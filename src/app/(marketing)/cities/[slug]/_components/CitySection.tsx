import Link from "next/link";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"] });

interface CitySectionProps {
  id: string;
  title: string;
  count: number;
  seeAllHref?: string;
  addHref?: string;
  addLabel?: string;
  emptyText: string;
  children: React.ReactNode;
  isEmpty: boolean;
}

export function CitySection({
  id,
  title,
  count,
  seeAllHref,
  addHref = "/discover/spots",
  addLabel = "Add →",
  emptyText,
  children,
  isEmpty,
}: CitySectionProps) {
  return (
    <section id={id} style={{ paddingTop: "48px", paddingBottom: "8px", scrollMarginTop: "108px" }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "16px", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
          <h2
            className={playfair.className}
            style={{ fontSize: "22px", fontWeight: 700, color: "#1B3A5C", margin: 0 }}
          >
            {title}
          </h2>
          {count > 0 && (
            <span style={{
              fontSize: "12px", fontWeight: 600, color: "#C4664A",
              backgroundColor: "#FFF3EE", borderRadius: "20px",
              padding: "2px 10px",
            }}>
              {count}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexShrink: 0 }}>
          {seeAllHref && count > 0 && (
            <Link href={seeAllHref} style={{ fontSize: "13px", color: "#C4664A", textDecoration: "none", fontWeight: 600 }}>
              See all →
            </Link>
          )}
          {addHref && (
            <Link href={addHref} style={{ fontSize: "13px", color: "#888", textDecoration: "none" }}>
              {addLabel}
            </Link>
          )}
        </div>
      </div>

      {/* Content */}
      {isEmpty ? (
        <div style={{
          padding: "32px 24px", backgroundColor: "#FAFAFA",
          borderRadius: "12px", border: "1px dashed #E5E7EB",
          textAlign: "center",
        }}>
          <p style={{ fontSize: "14px", color: "#9CA3AF", margin: 0 }}>{emptyText}</p>
        </div>
      ) : (
        <div style={{
          display: "flex", overflowX: "auto",
          gap: "12px", paddingBottom: "16px",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          msOverflowStyle: "none",
        }}>
          {children}
        </div>
      )}
    </section>
  );
}
