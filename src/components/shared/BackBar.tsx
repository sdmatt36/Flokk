import Link from "next/link";

interface Crumb {
  label: string;
  href: string;
}

interface BackBarProps {
  backLabel: string;
  backHref: string;
  crumbs?: Crumb[];
}

export function BackBar({ backLabel, backHref, crumbs = [] }: BackBarProps) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderBottom: "1px solid #EEEEEE",
        padding: "0 24px",
        minHeight: "44px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "8px",
      }}
    >
      <Link
        href={backHref}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "13px",
          fontWeight: 700,
          color: "#C4664A",
          textDecoration: "none",
        }}
      >
        ← {backLabel}
      </Link>
      {crumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "2px",
            fontSize: "12px",
            color: "#717171",
          }}
        >
          {crumbs.map((crumb, i) => (
            <span key={crumb.href} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              {i > 0 && <span style={{ opacity: 0.6, padding: "0 3px" }}>›</span>}
              <Link href={crumb.href} style={{ color: "inherit", textDecoration: "none" }}>
                {crumb.label}
              </Link>
            </span>
          ))}
        </nav>
      )}
    </div>
  );
}
